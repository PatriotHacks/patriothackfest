import { brandedHtml, brandedText, escapeHtml } from "./layout"
import {
  fill,
  renderBody,
  type EmailTemplate,
  type RenderedEmail,
} from "./templates"

export const BROADCAST_VARIABLES = [
  "name",
  "event_name",
  "event_dates",
] as const

export type BroadcastVariable = (typeof BROADCAST_VARIABLES)[number]

export type BroadcastValues = Record<BroadcastVariable, string | null>

export const EMAIL_DAILY_LIMIT = 1800

export function renderBroadcast(
  template: EmailTemplate,
  values: BroadcastValues
): RenderedEmail {
  const subject = fill(template.subject, values).trim()
  const { text, html } = renderBody(template.body, values)
  return {
    subject,
    text: brandedText({ body: text }),
    html: brandedHtml({
      preheader: escapeHtml(subject),
      heading: escapeHtml(subject),
      paragraphs: html,
    }),
  }
}
