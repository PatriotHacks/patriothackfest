import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { JudgingClosedNotice } from "@/components/judge/judging-closed"
import { JudgeProjectDetails } from "@/components/judge/project-details"
import { JudgeScorecardForm } from "@/components/judge/scorecard"
import { getJudgeEvent } from "@/lib/judge-access"
import { getJudgeAssignment, getJudgeQueue } from "@/lib/judge-review-data"
import {
  judgeBriefingHref,
  judgeRouteSchema,
  queuePosition,
  reviewContext,
} from "@/lib/judge-reviews"
import { judgingClosed } from "@/lib/judge-status"

export default async function JudgeAssignmentPage({
  params,
}: PageProps<"/judge/[eventSlug]/[assignmentId]">) {
  const route = judgeRouteSchema.safeParse(await params)
  if (!route.success) notFound()
  const { eventSlug, assignmentId } = route.data
  const event = await getJudgeEvent(eventSlug)
  if (event && judgingClosed(event)) return <JudgingClosedNotice />
  if (event && !event.briefing_acknowledged_at)
    redirect(judgeBriefingHref(eventSlug))
  const [detail, queue] = event
    ? await Promise.all([
        getJudgeAssignment(eventSlug, assignmentId),
        getJudgeQueue(eventSlug),
      ])
    : [null, null]
  return (
    <div data-wide className="flex flex-col gap-5">
      <Link className="text-sm underline" href="/judge">
        Back to dashboard
      </Link>
      {!event || !detail ? (
        <section className={cn(PAPER, "max-w-4xl p-6")}>
          <h1 className={cn(SERIF, "text-3xl")}>Assignment unavailable</h1>
          <p>
            This review is not available to your active judge account. Return to
            your dashboard or contact an organizer.
          </p>
        </section>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="flex min-w-0 flex-col gap-5">
            <p className="text-sm">{event.name}</p>
            <h1 className={cn(SERIF, "text-4xl break-words")}>
              {detail.project.name}
            </h1>
            <JudgeProjectDetails
              detail={detail}
              context={reviewContext(detail.assignment)}
            />
          </div>
          <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100svh-3rem)] lg:overflow-y-auto">
            <JudgeScorecardForm
              key={detail.assignment.id}
              assignment={detail.assignment}
              criteria={detail.criteria}
              event={event}
              position={queue && queuePosition(eventSlug, queue, assignmentId)}
            />
          </aside>
        </div>
      )}
    </div>
  )
}
