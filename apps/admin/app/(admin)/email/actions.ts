"use server"

import {
  BROADCAST_VARIABLES,
  EMAIL_DAILY_LIMIT,
  renderBroadcast,
  renderStatusUpdate,
  sendBatch,
  smtpTransport,
  validateTemplate,
  type RenderedEmail,
  type SendResult,
} from "@workspace/email"
import { ROLES, type Role } from "@workspace/supabase/roles"
import { revalidatePath } from "next/cache"
import * as z from "zod"

import type {
  RetryEmailsResult,
  SendEmailsResult,
} from "@/components/email-sender"
import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import {
  EMAIL_NOT_CONFIGURED,
  emailSettings,
  isEmailConfigured,
} from "@/lib/email"
import { BROADCAST_SAMPLE_VALUES, SAMPLE_VALUES } from "@/lib/email-templates"

const BATCH_SIZE = 10

const templateInput = z.object({
  subject: z.string(),
  body: z.string(),
})

const broadcastTarget = z.object({
  eventId: z.guid(),
  role: z.enum(ROLES).nullable(),
})

export async function saveEmailTemplate(
  subject: string,
  body: string
): Promise<ActionResult> {
  const template = templateInput.parse({ subject, body })
  const { supabase } = await requireAdmin("organizer")
  const errors = validateTemplate(template)
  if (errors.length > 0) return { error: errors.join(" ") }

  const { data, error } = await supabase
    .from("email_templates")
    .update(template)
    .eq("key", "status_update")
    .select("key")
  if (error) return failure(error)
  if (data.length === 0) return { error: "Template not found" }

  revalidatePath("/email")
  return ok
}

async function sendTestTo(
  email: string,
  render: (portalUrl: string) => RenderedEmail
): Promise<ActionResult> {
  if (!isEmailConfigured()) return { error: EMAIL_NOT_CONFIGURED }
  if (!email) return { error: "Your account has no email address" }

  const { smtp, portalUrl } = emailSettings()
  const rendered = render(portalUrl)
  const transport = smtpTransport(smtp)
  try {
    await transport.send({
      ...rendered,
      to: email,
      subject: `[Test] ${rendered.subject}`,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  } finally {
    transport.close()
  }
  return ok
}

export async function sendTestEmail(
  subject: string,
  body: string
): Promise<ActionResult> {
  const template = templateInput.parse({ subject, body })
  const { email } = await requireAdmin("organizer")
  const errors = validateTemplate(template)
  if (errors.length > 0) return { error: errors.join(" ") }

  return sendTestTo(email, (portalUrl) =>
    renderStatusUpdate(template, SAMPLE_VALUES, portalUrl)
  )
}

export async function sendBroadcastTest(
  subject: string,
  body: string
): Promise<ActionResult> {
  const template = templateInput.parse({ subject, body })
  const { email } = await requireAdmin("organizer")
  const errors = validateTemplate(template, BROADCAST_VARIABLES)
  if (errors.length > 0) return { error: errors.join(" ") }

  return sendTestTo(email, () =>
    renderBroadcast(template, BROADCAST_SAMPLE_VALUES)
  )
}

export async function getBroadcastRecipientCount(
  eventId: string,
  role: Role | null
): Promise<
  { error: string } | { error: null; recipients: number; sentLast24h: number }
> {
  const target = broadcastTarget.parse({ eventId, role })
  const { supabase } = await requireAdmin("organizer")

  const { data, error } = await supabase
    .rpc("admin_broadcast_recipient_count", {
      p_event_id: target.eventId,
      p_role: target.role ?? undefined,
    })
    .single()
  if (error) return { error: error.message }

  return {
    error: null,
    recipients: data.recipients,
    sentLast24h: data.sent_last_24h,
  }
}

export async function createBroadcast(
  eventId: string,
  role: Role | null,
  subject: string,
  body: string,
  expected: number
): Promise<{ error: string } | { error: null; broadcastId: string }> {
  const target = broadcastTarget.parse({ eventId, role })
  const template = templateInput.parse({ subject, body })
  const count = z.int().positive().parse(expected)
  const { supabase } = await requireAdmin("organizer")
  const errors = validateTemplate(template, BROADCAST_VARIABLES)
  if (errors.length > 0) return { error: errors.join(" ") }
  if (!isEmailConfigured()) return { error: EMAIL_NOT_CONFIGURED }

  const budget = await supabase
    .rpc("admin_broadcast_recipient_count", {
      p_event_id: target.eventId,
      p_role: target.role ?? undefined,
    })
    .single()
  if (budget.error) return { error: budget.error.message }
  const remaining = EMAIL_DAILY_LIMIT - budget.data.sent_last_24h
  if (count > remaining)
    return {
      error: `This would send ${count} emails, but only ${Math.max(remaining, 0)} of the daily limit of ${EMAIL_DAILY_LIMIT} remain.`,
    }

  const { data, error } = await supabase
    .rpc("admin_create_broadcast", {
      p_event_id: target.eventId,
      p_role: target.role ?? undefined,
      p_subject: template.subject,
      p_body: template.body,
      p_expected: count,
    })
    .single()
  if (error) return { error: error.message }

  revalidatePath("/email")
  return { error: null, broadcastId: data.broadcast_id }
}

export async function sendBroadcastBatch(
  broadcastId: string
): Promise<SendEmailsResult> {
  const id = z.guid().parse(broadcastId)
  const { supabase } = await requireAdmin("organizer")
  if (!isEmailConfigured()) return { error: EMAIL_NOT_CONFIGURED }
  const { smtp } = emailSettings()

  const broadcast = await supabase
    .from("email_broadcasts")
    .select("subject, body")
    .eq("id", id)
    .single()
  if (broadcast.error) return { error: broadcast.error.message }

  const claimed = await supabase.rpc("admin_claim_broadcast_emails", {
    p_broadcast_id: id,
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
        ...renderBroadcast(broadcast.data, {
          name: email.full_name || "there",
          event_name: email.event_name,
        }),
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
    .eq("broadcast_id", id)
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

export async function retryBroadcast(
  broadcastId: string
): Promise<RetryEmailsResult> {
  const id = z.guid().parse(broadcastId)
  const { supabase } = await requireAdmin("organizer")

  const { data, error } = await supabase.rpc("admin_retry_failed_broadcast", {
    p_broadcast_id: id,
  })
  if (error) return { error: error.message }

  revalidatePath("/email")
  return { error: null, count: data }
}
