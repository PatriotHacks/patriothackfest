import type { ApplicationStatus } from "./roles"

export function decisionBlockedReason(
  application: {
    status: ApplicationStatus
    declined_at: string | null
    released: boolean
  },
  isOrganizer: boolean
) {
  if (application.status !== "submitted")
    return "Only submitted applications can have a decision"
  if (application.declined_at)
    return "The applicant declined; this decision is final"
  if (application.released && !isOrganizer)
    return "Decisions are released; only organizers can change them"
  return null
}
