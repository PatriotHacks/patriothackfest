"use server"

import {
  renderStatusUpdate,
  sendBatch,
  smtpTransport,
  type SendResult,
} from "@workspace/email"
import { formatDateRangeInZone } from "@workspace/forms"
import { roleLabel } from "@workspace/supabase/roles"
import { revalidatePath } from "next/cache"
import * as z from "zod"

import type {
  RetryEmailsResult,
  SendEmailsResult,
} from "@/components/email-sender"
import { failure, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import {
  EMAIL_NOT_CONFIGURED,
  emailSettings,
  isEmailConfigured,
} from "@/lib/email"

const BATCH_SIZE = 10

const releaseResult = z.object({ queued: z.number(), undecided: z.number() })

export async function releaseDecisions(
  formId: string
): Promise<ActionResult & { queued?: number; undecided?: number }> {
  const id = z.guid().parse(formId)
  const { supabase } = await requireAdmin("organizer")

  const { data, error } = await supabase.rpc("admin_release_decisions", {
    p_form_id: id,
  })
  if (error) return failure(error)

  revalidatePath("/", "layout")
  return { error: null, ...releaseResult.parse(data) }
}

export async function sendPendingEmails(
  formId: string
): Promise<SendEmailsResult> {
  const id = z.guid().parse(formId)
  const { supabase } = await requireAdmin("organizer")
  if (!isEmailConfigured()) return { error: EMAIL_NOT_CONFIGURED }
  const { smtp, portalUrl } = emailSettings()

  const template = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("key", "status_update")
    .single()
  if (template.error) return { error: template.error.message }

  const form = await supabase
    .from("forms")
    .select("events(slug)")
    .eq("id", id)
    .single()
  if (form.error) return { error: form.error.message }

  const claimed = await supabase.rpc("admin_claim_emails", {
    p_form_id: id,
    p_limit: BATCH_SIZE,
  })
  if (claimed.error) return { error: claimed.error.message }

  const transport = smtpTransport(smtp)
  let results: SendResult[]
  try {
    results = await sendBatch(
      claimed.data,
      transport,
      (email) => ({
        to: email.email,
        ...renderStatusUpdate(
          template.data,
          {
            name: email.full_name || "there",
            event_name: email.event_name,
            event_dates: email.event_starts_at
              ? formatDateRangeInZone(
                  email.event_starts_at,
                  email.event_ends_at
                )
              : null,
            role: roleLabel(email.role, form.data.events.slug).toLowerCase(),
          },
          portalUrl
        ),
      }),
      async (result) => {
        const { error } = await supabase.rpc(
          "admin_finish_email",
          result.ok
            ? { p_id: result.id, p_ok: true, p_message_id: result.messageId }
            : { p_id: result.id, p_ok: false, p_error: result.error }
        )
        if (error) throw new Error(error.message)
      }
    )
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  } finally {
    transport.close()
  }

  const { count, error } = await supabase
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .eq("form_id", id)
    .eq("status", "pending")
  if (error) return { error: error.message }

  const sent = results.filter((r) => r.ok).length
  return {
    error: null,
    claimed: results.length,
    sent,
    failed: results.length - sent,
    remaining: count ?? 0,
  }
}

export async function retryFailedEmails(
  formId: string
): Promise<RetryEmailsResult> {
  const id = z.guid().parse(formId)
  const { supabase } = await requireAdmin("organizer")

  const { data, error } = await supabase.rpc("admin_retry_failed_emails", {
    p_form_id: id,
  })
  if (error) return { error: error.message }

  revalidatePath(`/forms/${id}/release`)
  return { error: null, count: data }
}
