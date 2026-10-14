import { endOfDayInZone } from "./time-zone"

export type DatedEvent = { starts_at: string | null; ends_at: string | null }

export function upcomingEvent<E extends DatedEvent>(
  events: readonly E[],
  now: number
) {
  const upcoming = events.find((event) => {
    const last = event.ends_at ?? event.starts_at
    return last !== null && now < Date.parse(endOfDayInZone(last))
  })
  return upcoming ?? events.at(-1) ?? null
}
