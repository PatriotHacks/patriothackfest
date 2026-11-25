import type { AssignmentOverview } from "@/lib/assignments"
import { GenerateAssignments } from "./generate-assignments"
import { RebalanceAssignments } from "./rebalance-assignments"
import { JudgeProgressTable } from "./judge-progress"
import type { JudgeProgress } from "@/lib/judge-progress"

export function AssignmentsSection({
  eventId,
  started,
  data,
  progress,
}: {
  eventId: string
  started: boolean
  data: AssignmentOverview
  progress: JudgeProgress[]
}) {
  return (
    <section
      id="assignments"
      aria-labelledby="assignments-heading"
      className="flex scroll-mt-6 flex-col gap-4"
    >
      <h2 id="assignments-heading" className="text-xl font-semibold">
        Assignments
      </h2>
      <p className="text-sm text-muted-foreground">
        Sponsor contexts with the fewest eligible judges are assigned first,
        then general judging. This greedy routine does not guarantee optimal
        coverage. Increase capacity if slots remain missing.
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <GenerateAssignments eventId={eventId} started={started} />
        <RebalanceAssignments eventId={eventId} started={started} />
      </div>
      <p className="font-medium">
        {data.missing} missing review slots across this event
      </p>
      <p className="text-sm text-muted-foreground">
        Coverage counts assigned reviews, not completed reviews. All
        non-cancelled work counts, including completed work and assignments held
        by inactive judges. Existing work is never silently removed when targets
        or capacity decrease.
      </p>
      <JudgeProgressTable judges={progress} />
    </section>
  )
}
