import { currentEvent, type DatedEvent } from "@workspace/forms"
import type { Role } from "@workspace/supabase/roles"

type RoleApplication = { role: Role; events: DatedEvent }

export function participantView(
  applications: readonly RoleApplication[],
  now: number
) {
  const events = applications
    .map((application) => ({ ...application.events, role: application.role }))
    .sort(
      (a, b) =>
        (a.starts_at === null ? Infinity : Date.parse(a.starts_at)) -
        (b.starts_at === null ? Infinity : Date.parse(b.starts_at))
    )
  return currentEvent(events, now)?.role === "volunteer"
    ? "mentor"
    : "participant"
}
