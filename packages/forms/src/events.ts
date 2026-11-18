import { endOfDayInZone } from "./time-zone"

export type DatedEvent = { starts_at: string | null; ends_at: string | null }

export function currentEvent<E extends DatedEvent>(
  events: readonly E[],
  now: number
) {
  const current = events.find((event) => {
    const last = event.ends_at ?? event.starts_at
    return last !== null && now < Date.parse(endOfDayInZone(last))
  })
  return current ?? null
}

export function upcomingEvent<E extends DatedEvent>(
  events: readonly E[],
  now: number
) {
  return currentEvent(events, now) ?? events.at(-1) ?? null
}
