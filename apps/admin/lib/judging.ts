import { fromZonedInputValue, toZonedInputValue } from "@workspace/forms"
import * as z from "zod"

const localDateTime = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false
  try {
    return toZonedInputValue(fromZonedInputValue(value)) === value
  } catch {
    return false
  }
}, "Enter a valid Eastern date and time")

export const competitionSettingsInput = z.object({
  eventId: z.guid(),
  enabled: z.boolean(),
  open: z.union([z.literal(""), localDateTime]),
  close: z.union([z.literal(""), localDateTime]),
  judgingEnd: z.union([z.literal(""), localDateTime]),
  generalReviews: z.number().int().min(1).max(20),
})

export type CompetitionSettingsInput = z.infer<typeof competitionSettingsInput>

export function competitionDates(input: CompetitionSettingsInput) {
  const open = input.open ? fromZonedInputValue(input.open) : null
  const close = input.close ? fromZonedInputValue(input.close) : null
  // The UI selects the final included minute, while SQL uses an exclusive cutoff.
  const judgingClose = input.judgingEnd
    ? new Date(
        Date.parse(fromZonedInputValue(input.judgingEnd)) + 60_000
      ).toISOString()
    : null

  if (input.enabled && (!open || !judgingClose)) {
    throw new Error("Set submission opening and judging end before enabling")
  }
  if (close && (!open || Date.parse(close) <= Date.parse(open))) {
    throw new Error("Submission closing must be after opening")
  }
  const lastSubmissionDate = close ?? open
  if (
    judgingClose &&
    lastSubmissionDate &&
    Date.parse(judgingClose) <= Date.parse(lastSubmissionDate)
  ) {
    throw new Error("Judging end must be after the submission dates")
  }
  return { open, close, judgingClose }
}

export function judgingEndInputValue(cutoff: string | null) {
  return cutoff
    ? toZonedInputValue(new Date(Date.parse(cutoff) - 60_000).toISOString())
    : ""
}

export const competitionTrackInput = z.object({
  eventId: z.guid(),
  trackId: z.guid().optional(),
  name: z.string().trim().min(1).max(120),
  sponsor: z.string().trim().max(120),
  description: z.string().trim().max(2000),
  reviews: z.number().int().min(1).max(20),
  active: z.boolean(),
})

export type CompetitionTrackInput = z.infer<typeof competitionTrackInput>
