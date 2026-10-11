const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

export function formatEventDates(
  startsOn: string | null,
  endsOn: string | null
) {
  if (!startsOn) return "Dates coming soon"
  const start = new Date(`${startsOn}T00:00:00Z`)
  if (!endsOn) return dateFormat.format(start)
  return dateFormat.formatRange(start, new Date(`${endsOn}T00:00:00Z`))
}
