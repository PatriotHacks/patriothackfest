import { formatInZone } from "@workspace/forms"

import type { ApplicationPhase, FormTiming } from "./application-status"

export function deadlineText(phase: ApplicationPhase, form: FormTiming) {
  const close = form.submissions_close_at
  const lock = form.edits_lock_at
  switch (phase) {
    case "draft":
      return close && `Submit by ${formatInZone(close)}`
    case "closed_draft":
      return close && `Submissions closed ${formatInZone(close)}`
    case "editable_submission":
      return lock && `You can edit your answers until ${formatInZone(lock)}`
    case "locked_submission":
      return lock && `Answers locked ${formatInZone(lock)}`
    case "withdrawn":
    case "declined":
      return null
  }
}
