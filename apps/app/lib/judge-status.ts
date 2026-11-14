export function judgeWindowStatus(
  event: { judging_started_at: string | null; judging_close_at: string | null },
  now = Date.now()
) {
  if (!event.judging_started_at) return "not-started"
  if (event.judging_close_at && now >= Date.parse(event.judging_close_at))
    return "ended"
  return "started"
}
