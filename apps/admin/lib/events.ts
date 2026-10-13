import { fromZonedInputValue, toZonedInputValue } from "@workspace/forms"

type EventDates = {
  slug: string
  starts_at: string | null
  ends_at: string | null
}

function startOfTodayInEventZone() {
  const today = toZonedInputValue(new Date().toISOString()).slice(0, 10)
  return Date.parse(fromZonedInputValue(`${today}T00:00`))
}

// Expects events ordered by starts_at with nulls last.
export function selectEvent<Event extends EventDates>(
  events: Event[],
  slug: string | undefined
): Event | undefined {
  const today = startOfTodayInEventZone()
  return (
    events.find((e) => e.slug === slug) ??
    events.find((e) => {
      const end = e.ends_at ?? e.starts_at
      return end !== null && Date.parse(end) >= today
    }) ??
    events.at(-1)
  )
}
