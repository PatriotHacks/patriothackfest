export type Decision = "accepted" | "waitlisted" | "rejected"

export const TEMPLATE_KEYS = [
  "accepted",
  "accepted_from_waitlisted",
  "accepted_from_rejected",
  "waitlisted",
  "waitlisted_from_accepted",
  "waitlisted_from_rejected",
  "rejected",
  "rejected_from_accepted",
  "rejected_from_waitlisted",
] as const

export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export const TEMPLATE_VARIABLES = [
  "name",
  "event_name",
  "event_dates",
  "role",
  "dashboard_url",
] as const

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]

export type TemplateValues = Record<TemplateVariable, string | null>

export type EmailTemplate = { subject: string; body: string }

export type RenderedEmail = { subject: string; text: string; html: string }

export const SUBJECT_MAX_LENGTH = 200
export const BODY_MAX_LENGTH = 10000

const VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g

export function templateKey(
  decision: Decision,
  previousDecision: Decision | "pending" | null | undefined
): TemplateKey {
  if (
    previousDecision == null ||
    previousDecision === "pending" ||
    previousDecision === decision
  ) {
    return decision
  }
  return `${decision}_from_${previousDecision}` as TemplateKey
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function isVariable(name: string): name is TemplateVariable {
  return (TEMPLATE_VARIABLES as readonly string[]).includes(name)
}

export function unknownVariables({ subject, body }: EmailTemplate) {
  const names = [...`${subject}\n${body}`.matchAll(VARIABLE)].map((m) => m[1]!)
  return [...new Set(names.filter((name) => !isVariable(name)))]
}

export function validateTemplate(template: EmailTemplate) {
  const errors: string[] = []
  const { subject, body } = template
  if (!/\S/.test(subject)) errors.push("Subject is required.")
  if (subject.length > SUBJECT_MAX_LENGTH)
    errors.push(`Subject must be at most ${SUBJECT_MAX_LENGTH} characters.`)
  if (/[\r\n]/.test(subject)) errors.push("Subject must be a single line.")
  if (!/\S/.test(body)) errors.push("Body is required.")
  if (body.length > BODY_MAX_LENGTH)
    errors.push(`Body must be at most ${BODY_MAX_LENGTH} characters.`)
  const unknown = unknownVariables(template)
  if (unknown.length > 0)
    errors.push(
      `Unknown variables: ${unknown.map((name) => `{{${name}}}`).join(", ")}.`
    )
  return errors
}

function fill(
  source: string,
  values: TemplateValues,
  format: (name: TemplateVariable, value: string) => string = (_, v) => v
) {
  return source.replace(VARIABLE, (_, name: string) => {
    if (!isVariable(name)) throw new Error(`Unknown variable {{${name}}}`)
    const value = values[name]
    if (value === null) throw new Error(`No value for {{${name}}}`)
    return format(name, value)
  })
}

const UNLINKED: readonly TemplateVariable[] = ["name"]
const TOKEN = /\uE000(\d+)\uE001/g
const URL = /https?:\/\/[^\s<>"\uE000]*[^\s<>".,;:!?)'\]\uE000\uE001]/g

function htmlLine(line: string, unlinked: string[]) {
  let html = ""
  let last = 0
  for (const match of line.matchAll(URL)) {
    const url = escapeHtml(match[0])
    html += escapeHtml(line.slice(last, match.index))
    html += `<a href="${url}" style="color:#006633">${url}</a>`
    last = match.index + match[0].length
  }
  html += escapeHtml(line.slice(last))
  return html.replace(TOKEN, (_, i: string) => escapeHtml(unlinked[Number(i)]!))
}

function paragraphs(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n[^\S\n]*\n\s*/)
}

export function renderTemplate(
  template: EmailTemplate,
  values: TemplateValues
): RenderedEmail {
  const subject = fill(template.subject, values).trim()
  const text = paragraphs(fill(template.body, values)).join("\n\n")

  const unlinked: string[] = []
  const body = fill(template.body, values, (name, value) => {
    if (!UNLINKED.includes(name)) return value
    unlinked.push(value)
    return `\uE000${unlinked.length - 1}\uE001`
  })
  const content = paragraphs(body)
    .map((p) => {
      const lines = p.split("\n").map((line) => htmlLine(line, unlinked))
      return `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#1f2937">${lines.join("<br>")}</p>`
    })
    .join("\n")

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px;background:#ffffff;border-radius:8px">
${content}
</div>
</body>
</html>`

  return { subject, text, html }
}
