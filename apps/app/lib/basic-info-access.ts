import { endOfDayInZone } from "@workspace/forms"
import type { Database } from "@workspace/supabase/types"

export type BasicInfoApplication = {
  status: Database["public"]["Enums"]["application_status"]
  events: { starts_at: string | null; ends_at: string | null }
  forms: { edits_lock_at: string | null }
}

export const BASIC_INFO_APPLICATION_COLUMNS =
  "status, events(starts_at, ends_at), forms(edits_lock_at)"

function eventHasEnded(
  { starts_at, ends_at }: BasicInfoApplication["events"],
  now: number
) {
  const last = ends_at ?? starts_at
  return last !== null && now >= Date.parse(endOfDayInZone(last))
}

export function basicInfoAccess(
  applications: BasicInfoApplication[],
  now: number
) {
  const hasDraft = applications.some((a) => a.status === "draft")
  const active = applications.filter(
    (a) => a.status === "submitted" && !eventHasEnded(a.events, now)
  )
  const editsOpen = active.every(
    (a) =>
      a.forms.edits_lock_at === null || now < Date.parse(a.forms.edits_lock_at)
  )
  return {
    fields: hasDraft && active.length === 0,
    dateOfBirth: (hasDraft || active.length > 0) && editsOpen,
  }
}
