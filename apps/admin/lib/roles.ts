import type { Database } from "@workspace/supabase/types"

export type Role = Database["public"]["Enums"]["app_role"]
export type Decision = Database["public"]["Enums"]["decision"]
export type ApplicationStatus =
  Database["public"]["Enums"]["application_status"]

export const ROLES: Role[] = ["participant", "volunteer", "judge"]

export const ROLE_LABELS: Record<Role, string> = {
  participant: "Participant",
  volunteer: "Volunteer",
  judge: "Judge",
}

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
