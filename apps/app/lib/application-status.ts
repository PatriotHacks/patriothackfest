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

export function isFormOpen(form: FormTiming, now: number) {
  return (
    form.status === "published" &&
    form.submissions_close_at !== null &&
    now < Date.parse(form.submissions_close_at)
  )
}

export function applicationPhase(
  status: Enums["application_status"],
  form: FormTiming,
  now: number
): ApplicationPhase {
  if (status === "withdrawn") return "withdrawn"
  if (status === "draft")
    return isFormOpen(form, now) ? "draft" : "closed_draft"
  return form.edits_lock_at !== null && now < Date.parse(form.edits_lock_at)
    ? "editable_submission"
    : "locked_submission"
}

export type StatusLabel = {
  label: string
  variant: "default" | "secondary" | "outline" | "destructive"
}

export function statusLabel(
  phase: ApplicationPhase,
  form: FormTiming,
  decision: Enums["decision"] | null
): StatusLabel {
  if (phase === "withdrawn") return { label: "Withdrawn", variant: "outline" }
  if (phase === "draft") return { label: "Draft", variant: "secondary" }
  if (phase === "closed_draft")
    return { label: "Not submitted", variant: "outline" }
  if (form.decisions_released_at === null)
    return { label: "Submitted", variant: "secondary" }
  switch (decision) {
    case "accepted":
      return { label: "Accepted", variant: "default" }
    case "waitlisted":
      return { label: "Waitlisted", variant: "secondary" }
    case "rejected":
      return { label: "Not accepted", variant: "destructive" }
    default:
      return { label: "Under review", variant: "secondary" }
  }
}
