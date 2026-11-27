import { EVENT_TIME_ZONE } from "@workspace/forms"

export function judgeWindowStatus(
  event: {
    enabled?: boolean
    judging_started_at: string | null
    judging_close_at: string | null
  },
  now = Date.now()
) {
  if (event.enabled === false || !event.judging_started_at) return "not-started"
  if (!event.judging_close_at || now >= Date.parse(event.judging_close_at))
    return "ended"
  return "started"
}

// Mirrors public.judging_closed: judges lose review access once the deadline passes.
export function judgingClosed(
  event: { judging_close_at: string | null },
  now = Date.now()
) {
  return (
    event.judging_close_at !== null && now >= Date.parse(event.judging_close_at)
  )
}

export function allJudgingClosed(
  events: { judging_close_at: string | null }[],
  now = Date.now()
) {
  return events.length > 0 && events.every((event) => judgingClosed(event, now))
}

export function submissionsStillOpen(closeAt: string, now = Date.now()) {
  return now < Date.parse(closeAt)
}

const ORDINAL: Record<string, string> = {
  one: "st",
  two: "nd",
  few: "rd",
  other: "th",
}

export function formatSubmissionDeadline(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EVENT_TIME_ZONE,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value])
  )
  const ordinal = new Intl.PluralRules("en-US", { type: "ordinal" })
  return `${parts.month} ${parts.day}${ORDINAL[ordinal.select(Number(parts.day))]} ${parts.hour}:${parts.minute}${parts.dayPeriod!.toLowerCase()}`
}
