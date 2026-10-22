import type { Database } from "@workspace/supabase/types"

type Enums = Database["public"]["Enums"]

export type FormTiming = {
  status: Enums["form_status"]
  submissions_close_at: string | null
  edits_lock_at: string | null
  decisions_released_at: string | null
}

export type ApplicationPhase =
  | "draft"
  | "closed_draft"
  | "editable_submission"
  | "locked_submission"
  | "withdrawn"
  | "declined"

export function isFormOpen(form: FormTiming, now: number) {
  return (
    form.status === "published" &&
    form.submissions_close_at !== null &&
    now < Date.parse(form.submissions_close_at)
  )
}

export function applicationPhase(
  status: Enums["application_status"],
  declinedAt: string | null,
  form: FormTiming,
  now: number
): ApplicationPhase {
  if (status === "withdrawn") return "withdrawn"
  if (declinedAt !== null) return "declined"
  if (status === "draft")
    return isFormOpen(form, now) ? "draft" : "closed_draft"
  return form.edits_lock_at !== null && now >= Date.parse(form.edits_lock_at)
    ? "locked_submission"
    : "editable_submission"
}

export function statusLabel(
  phase: ApplicationPhase,
  form: FormTiming,
  decision: Enums["decision"] | null
) {
  if (phase === "withdrawn") return "Withdrawn"
  if (phase === "declined") return "Declined"
  if (phase === "draft") return "Draft"
  if (phase === "closed_draft") return "Not submitted"
  if (form.decisions_released_at === null) return "Submitted"
  switch (decision) {
    case "accepted":
      return "Accepted"
    case "waitlisted":
      return "Waitlisted"
    case "rejected":
      return "Not accepted"
    default:
      return "Under review"
  }
}

export type DeclinableDecision = "accepted" | "waitlisted"

export type ApplicantAction =
  | { kind: "withdraw" }
  | { kind: "decline"; decision: DeclinableDecision }
  | null

export function applicantAction(
  phase: ApplicationPhase,
  form: FormTiming,
  decision: Enums["decision"] | null
): ApplicantAction {
  const decisionVisible =
    form.decisions_released_at !== null &&
    decision !== null &&
    decision !== "pending"
  if (!decisionVisible)
    return phase === "draft" ||
      phase === "editable_submission" ||
      phase === "locked_submission"
      ? { kind: "withdraw" }
      : null
  if (
    (phase === "editable_submission" || phase === "locked_submission") &&
    (decision === "accepted" || decision === "waitlisted")
  )
    return { kind: "decline", decision }
  return null
}

export function declinedText(decision: Enums["decision"] | null) {
  return decision === "waitlisted"
    ? "You left the waitlist"
    : "You declined your spot"
}
