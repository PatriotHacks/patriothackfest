export const EVENT_TIME_ZONE = "America/New_York"

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)!.value)
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  }
}

function offsetMs(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

const pad = (n: number) => n.toString().padStart(2, "0")

export function toZonedInputValue(iso: string, timeZone = EVENT_TIME_ZONE) {
  const p = zonedParts(new Date(iso), timeZone)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

export function fromZonedInputValue(value: string, timeZone = EVENT_TIME_ZONE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error(`Invalid date-time: ${value}`)
  const [, y, mo, d, h, mi] = match.map(Number) as number[]
  const wallClock = Date.UTC(y!, mo! - 1, d!, h!, mi!)
  const first = wallClock - offsetMs(new Date(wallClock), timeZone)
  const second = wallClock - offsetMs(new Date(first), timeZone)
  return new Date(second).toISOString()
}

export function formatInZone(iso: string, timeZone = EVENT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso))
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

export function formatDateRangeInZone(
  startIso: string,
  endIso: string | null,
  timeZone = EVENT_TIME_ZONE
) {
  const s = zonedParts(new Date(startIso), timeZone)
  const startText = `${MONTHS[s.month - 1]} ${s.day}`
  if (!endIso) return `${startText}, ${s.year}`
  const e = zonedParts(new Date(endIso), timeZone)
  if (s.year !== e.year) {
    return `${startText}, ${s.year} – ${MONTHS[e.month - 1]} ${e.day}, ${e.year}`
  }
  if (s.month !== e.month) {
    return `${startText} – ${MONTHS[e.month - 1]} ${e.day}, ${e.year}`
  }
  if (s.day !== e.day) return `${startText}–${e.day}, ${e.year}`
  return `${startText}, ${s.year}`
}
