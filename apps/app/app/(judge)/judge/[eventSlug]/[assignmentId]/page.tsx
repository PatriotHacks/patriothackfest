import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

import { JudgeProjectDetails } from "@/components/judge/project-details"
import { JudgeDeadline } from "@/components/judge/deadline"
import { JudgeScorecardForm } from "@/components/judge/scorecard"
import { getJudgeEvent } from "@/lib/judge-access"
import { getJudgeAssignment } from "@/lib/judge-review-data"
import { judgeRouteSchema } from "@/lib/judge-reviews"

export default async function JudgeAssignmentPage({
  params,
}: PageProps<"/judge/[eventSlug]/[assignmentId]">) {
  const route = judgeRouteSchema.safeParse(await params)
  if (!route.success) notFound()
  const { eventSlug, assignmentId } = route.data
  const event = await getJudgeEvent(eventSlug)
  const detail = event
    ? await getJudgeAssignment(eventSlug, assignmentId)
    : null
  return (
    <>
      <Link
        className="text-sm underline"
        href={`/judge/${encodeURIComponent(eventSlug)}`}
      >
        Back to your queue
      </Link>
      {!event || !detail ? (
        <section className={cn(PAPER, "p-6")}>
          <h1 className={cn(SERIF, "text-3xl")}>Assignment unavailable</h1>
          <p>
            This review is not available to your active judge account. Return to
            your queue or contact an organizer.
          </p>
        </section>
      ) : (
        <>
          <p className="text-sm">{event.name}</p>
          <h1 className={cn(SERIF, "text-4xl break-words")}>
            {detail.project.name}
          </h1>
          <JudgeDeadline closeAt={event.judging_close_at} />
          <JudgeProjectDetails detail={detail} />
          <JudgeScorecardForm
            key={detail.assignment.id}
            assignment={detail.assignment}
            event={event}
          />
        </>
      )}
    </>
  )
}
