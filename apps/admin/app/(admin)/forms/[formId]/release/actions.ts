"use server"

import { decisionEmail, sendBatch, smtpTransport } from "@workspace/email"
import { revalidatePath } from "next/cache"
import * as z from "zod"

import { failure, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import {
  EMAIL_NOT_CONFIGURED,
  emailSettings,
  isEmailConfigured,
} from "@/lib/email"

const BATCH_SIZE = 25

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

type Failure = { error: string }

export async function sendPendingEmails(formId: string): Promise<
  | Failure
  | {
      error: null
      claimed: number
      sent: number
      failed: number
      remaining: number
    }
> {
  const id = z.guid().parse(formId)
  const { supabase } = await requireAdmin("organizer")
  if (!isEmailConfigured()) return { error: EMAIL_NOT_CONFIGURED }
  const { smtp, portalUrl } = emailSettings()

  const claimed = await supabase.rpc("admin_claim_emails", {
    p_form_id: id,
    p_limit: BATCH_SIZE,
  })
  if (claimed.error) return { error: claimed.error.message }

  const transport = smtpTransport(smtp)
  const results = await sendBatch(claimed.data, transport, (email) => {
    if (email.decision === "pending")
      throw new Error("Pending decisions are not emailed")
    return {
      to: email.email,
      ...decisionEmail({
        decision: email.decision,
        previousDecision: email.previous_decision,
        name: email.full_name,
        eventName: email.event_name,
        role: email.role,
        portalUrl,
      }),
    }
  }).finally(() => transport.close())

  const finished = await Promise.all(
    results.map((result) =>
      supabase.rpc(
        "admin_finish_email",
        result.ok
          ? { p_id: result.id, p_ok: true, p_message_id: result.messageId }
          : { p_id: result.id, p_ok: false, p_error: result.error }
      )
    )
  )
  const finishError = finished.find((f) => f.error)?.error
  if (finishError) return { error: finishError.message }

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
): Promise<Failure | { error: null; count: number }> {
  const id = z.guid().parse(formId)
  const { supabase } = await requireAdmin("organizer")

  const { data, error } = await supabase.rpc("admin_retry_failed_emails", {
    p_form_id: id,
  })
  if (error) return { error: error.message }

  revalidatePath(`/forms/${id}/release`)
  return { error: null, count: data }
}
