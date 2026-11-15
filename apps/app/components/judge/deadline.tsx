import { formatInZone } from "@workspace/forms"

export function JudgeDeadline({ closeAt }: { closeAt: string | null }) {
  return (
    <p className="text-sm">
      {closeAt
        ? `Judging ends ${formatInZone(new Date(Date.parse(closeAt) - 60_000).toISOString())}, including that final minute.`
        : "No judging deadline configured yet."}{" "}
      Times are in America/New_York.
    </p>
  )
}
