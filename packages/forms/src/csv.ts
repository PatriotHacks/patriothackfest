import { fileAnswerSchema, isSection, type Answers, type Field } from "./schema"
import { formatInZone } from "./time-zone"
import { pruneHiddenAnswers } from "./visibility"

export type ApplicationCsvRow = {
  id: string
  fullName: string | null
  email: string
  school: string | null
  phone: string | null
  dateOfBirth: string | null
  under18: boolean | null
  role: "participant" | "volunteer" | "judge"
  status: "draft" | "submitted" | "withdrawn"
  submittedAt: string | null
  decision: "pending" | "accepted" | "waitlisted" | "rejected"
  decidedAt: string | null
  decisionsReleased: boolean
  declinedAt: string | null
  withdrawnAt: string | null
  answers: Answers
  applicationUrl: string
}

const FIXED_HEADERS = [
  "Application ID",
  "Full name",
  "Email",
  "School",
  "Phone",
  "Date of birth",
  "Under 18",
  "Role",
  "Status",
  "Submitted at",
  "Decision",
  "Decided at",
  "Decisions released",
  "Declined at",
  "Withdrawn at",
]

const FORMULA_PREFIX = /^[=+\-@\t\r]/

export function escapeCsvCell(value: string) {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function uniqueHeaders(labels: string[]) {
  const used = new Set<string>()
  return labels.map((label) => {
    let header = label
    for (let n = 2; used.has(header); n++) header = `${label} (${n})`
    used.add(header)
    return header
  })
}

const timestamp = (iso: string | null) => (iso ? formatInZone(iso) : "")
const yesNo = (value: boolean) => (value ? "yes" : "no")

function formatAnswer(field: Field, value: unknown, applicationUrl: string) {
  if (value === undefined || value === null) return ""
  if (field.type === "checkbox" && typeof value === "boolean")
    return yesNo(value)
  if (field.type === "multiple_choice" && Array.isArray(value))
    return value.join("; ")
  if (field.type === "file") {
    const file = fileAnswerSchema.safeParse(value)
    if (file.success) return `${file.data.name} (${applicationUrl})`
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value)
}

export function buildApplicationsCsv(
  schema: { fields: readonly Field[] },
  rows: readonly ApplicationCsvRow[]
) {
  const questions = schema.fields.filter((f) => !isSection(f))
  const header = uniqueHeaders([
    ...FIXED_HEADERS,
    ...questions.map((f) => f.label),
  ])
  const lines = rows.map((row) => {
    const answers = pruneHiddenAnswers(schema, row.answers)
    return [
      row.id,
      row.fullName ?? "",
      row.email,
      row.school ?? "",
      row.phone ?? "",
      row.dateOfBirth ?? "",
      row.under18 === null ? "" : yesNo(row.under18),
      row.role,
      row.status,
      timestamp(row.submittedAt),
      row.decision,
      timestamp(row.decidedAt),
      yesNo(row.decisionsReleased),
      timestamp(row.declinedAt),
      timestamp(row.withdrawnAt),
      ...questions.map((f) =>
        formatAnswer(f, answers[f.id], row.applicationUrl)
      ),
    ]
  })
  return [header, ...lines]
    .map((cells) => cells.map(escapeCsvCell).join(","))
    .join("\r\n")
    .concat("\r\n")
}
