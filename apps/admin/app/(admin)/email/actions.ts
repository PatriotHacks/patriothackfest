"use server"

import {
  renderTemplate,
  smtpTransport,
  TEMPLATE_KEYS,
  validateTemplate,
} from "@workspace/email"
import { revalidatePath } from "next/cache"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import {
  EMAIL_NOT_CONFIGURED,
  emailSettings,
  isEmailConfigured,
} from "@/lib/email"
import { SAMPLE_VALUES } from "@/lib/email-templates"

const templateInput = z.object({
  key: z.enum(TEMPLATE_KEYS),
  subject: z.string(),
  body: z.string(),
})

export async function saveEmailTemplate(
  key: string,
  subject: string,
  body: string
): Promise<ActionResult> {
  const template = templateInput.parse({ key, subject, body })
  const { supabase } = await requireAdmin("organizer")
  const errors = validateTemplate(template)
  if (errors.length > 0) return { error: errors.join(" ") }

  const { data, error } = await supabase
    .from("email_templates")
    .update({ subject: template.subject, body: template.body })
    .eq("key", template.key)
    .select("key")
  if (error) return failure(error)
  if (data.length === 0) return { error: "Template not found" }

  revalidatePath("/email")
  return ok
}

export async function sendTestEmail(
  key: string,
  subject: string,
  body: string
): Promise<ActionResult> {
  const template = templateInput.parse({ key, subject, body })
  const { email } = await requireAdmin("organizer")
  const errors = validateTemplate(template)
  if (errors.length > 0) return { error: errors.join(" ") }
  if (!isEmailConfigured()) return { error: EMAIL_NOT_CONFIGURED }
  if (!email) return { error: "Your account has no email address" }

  const { smtp, portalUrl } = emailSettings()
  const rendered = renderTemplate(template, {
    ...SAMPLE_VALUES,
    dashboard_url: portalUrl,
  })
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
