import { formatInZone } from "@workspace/forms"
import { PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import type { JudgeEvent } from "@/lib/judge-access"
import { judgeWindowStatus } from "@/lib/judge-status"

export function JudgeEventDetails({ event }: { event: JudgeEvent }) {
  const status = judgeWindowStatus(event)
  return (
    <section className={cn(PAPER, "flex flex-col gap-4 p-6")}>
      <h2 className="text-xl font-semibold">
        {event.kind === "general" ? "General judge" : "Sponsor judge"}
      </h2>
      {event.kind === "sponsor" && (
        <div>
          <h3 className="font-semibold">Authorized sponsor tracks</h3>
          <ul className="list-inside list-disc">
            {event.tracks.map((track) => (
              <li key={track.id}>
                {track.name}
                {!track.active && " (inactive)"}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p>Assignment capacity: {event.capacity}</p>
      <p>
        {status === "not-started"
          ? "Judging has not started. Organizers are preparing the event."
          : status === "ended"
            ? "The judging window has ended. Refresh this page to pick up any deadline extension."
            : "Judging has started."}
      </p>
      <p className="text-sm">
        {event.judging_close_at
          ? `Judging ends ${formatInZone(new Date(Date.parse(event.judging_close_at) - 60_000).toISOString())}, including that final minute.`
          : "No judging deadline configured yet."}{" "}
        Times are in America/New_York.
      </p>
      <p className="text-sm text-[#6E6E68]">
        Your judge access is confirmed. Assignment generation, project review
        queues, and scorecards are not implemented in this release.
      </p>
    </section>
  )
}
