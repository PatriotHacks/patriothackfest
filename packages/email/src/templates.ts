import { escapeHtml, statusUpdateHtml, statusUpdateText } from "./status-update"

export const TEMPLATE_VARIABLES = [
  "name",
  "event_name",
  "event_dates",
  "role",
] as const

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]

export type TemplateValues = Record<TemplateVariable, string | null>

export type EmailTemplate = { subject: string; body: string }

export type RenderedEmail = { subject: string; text: string; html: string }

export const SUBJECT_MAX_LENGTH = 200
export const BODY_MAX_LENGTH = 10000

const VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g

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
  format: (value: string) => string = (value) => value
) {
  return source.replace(VARIABLE, (_, name: string) => {
    if (!isVariable(name)) throw new Error(`Unknown variable {{${name}}}`)
    const value = values[name]
    if (value === null) throw new Error(`No value for {{${name}}}`)
    return format(value)
  })
}

function paragraphs(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n[^\S\n]*\n\s*/)
}

export function renderStatusUpdate(
  template: EmailTemplate,
  values: TemplateValues,
  dashboardUrl: string
): RenderedEmail {
  const subject = fill(template.subject, values).trim()
  const text = paragraphs(fill(template.body, values)).join("\n\n")
  const html = paragraphs(template.body).map((p) =>
    p
      .split("\n")
      .map((line) => fill(escapeHtml(line), values, escapeHtml))
      .join("<br>")
  )
  return {
    subject,
    text: statusUpdateText(text, dashboardUrl),
    html: statusUpdateHtml(html, dashboardUrl),
  }
}
