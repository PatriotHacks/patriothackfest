import { PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import type { JudgeEvent } from "@/lib/judge-access"
import { judgeWindowStatus } from "@/lib/judge-status"
import { JudgeDeadline } from "./deadline"

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
            ? "Judging is not open. Saved reviews remain available; open an unfinished scorecard to check for an extension without losing inputs."
            : "Judging has started."}
      </p>
      <JudgeDeadline closeAt={event.judging_close_at} />
    </section>
  )
}
