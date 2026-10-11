import type { Database } from "@workspace/supabase/types"

export type Decision = Database["public"]["Enums"]["decision"]
export type ApplicationStatus =
  Database["public"]["Enums"]["application_status"]

export const DECISIONS: Decision[] = [
  "pending",
  "accepted",
  "waitlisted",
  "rejected",
]

export const DECISION_LABELS: Record<Decision, string> = {
  pending: "Pending",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  rejected: "Not accepted",
}

export const STATUSES: ApplicationStatus[] = ["draft", "submitted", "withdrawn"]

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  withdrawn: "Withdrawn",
}
