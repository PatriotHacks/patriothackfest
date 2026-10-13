type EventDates = {
  slug: string
  starts_at: string | null
  ends_at: string | null
}

// Expects events ordered by starts_at with nulls last.
export function selectEvent<Event extends EventDates>(
  events: Event[],
  slug: string | undefined
): Event | undefined {
  const now = Date.now()
  return (
    events.find((e) => e.slug === slug) ??
    events.find((e) => {
      const end = e.ends_at ?? e.starts_at
      return end !== null && Date.parse(end) >= now
    }) ??
    events.at(-1)
  )
}
