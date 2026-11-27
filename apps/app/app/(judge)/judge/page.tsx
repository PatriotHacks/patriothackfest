import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import { BriefingReader } from "@/components/judge/briefing-reader"
import { JudgeEventDetails } from "@/components/judge/event-details"
import {
  GuestJudgeDetails,
  GuestProjectList,
} from "@/components/judge/guest-projects"
import { JudgingClosedNotice } from "@/components/judge/judging-closed"
import { JudgeQueueList } from "@/components/judge/queue"
import { JudgeScenario } from "@/components/judge/scenario"
import {
  getJudgeEvent,
  getJudgeEvents,
  getProjectSubmissionsCloseAt,
} from "@/lib/judge-access"
import { getGuestProjects, getJudgeQueue } from "@/lib/judge-review-data"
import { judgeBriefingHref, judgeContinuation } from "@/lib/judge-reviews"
import {
  formatSubmissionDeadline,
  judgeWindowStatus,
  judgingClosed,
  submissionsStillOpen,
} from "@/lib/judge-status"

export default async function JudgeDashboardPage({
  searchParams,
}: PageProps<"/judge">) {
  const { briefing } = await searchParams
  const events = await getJudgeEvents()
  if (events.length === 0)
    return (
      <section className={cn(PAPER, "flex flex-col gap-3 p-6")}>
        <h1 className="text-xl font-semibold">Judge access not configured</h1>
        <p>
          No active judge roster matches your verified signed-in account. Ask an
          organizer to check the email and active status. You do not need to
          submit a participant application.
        </p>
      </section>
    )
  return events.map((event) => (
    <JudgeEventSection
      key={event.event_id}
      slug={event.slug}
      briefing={briefing === event.slug}
    />
  ))
}

async function JudgeEventSection({
  slug,
  briefing,
}: {
  slug: string
  briefing: boolean
}) {
  const event = await getJudgeEvent(slug)
  if (!event)
    return (
      <p className={cn(PAPER, "p-6")}>
        Judge access unavailable. Your roster may have changed; contact an
        organizer.
      </p>
    )
  if (judgingClosed(event))
    return (
      <section className="flex flex-col gap-5">
        <h1 className={cn(SERIF, "text-4xl")}>{event.name}</h1>
        <JudgingClosedNotice />
      </section>
    )
  const [closeAt, queue, projects] = await Promise.all([
    getProjectSubmissionsCloseAt(event.event_id),
    event.guest ? null : getJudgeQueue(slug),
    event.guest ? getGuestProjects(slug) : null,
  ])
  const started = judgeWindowStatus(event) === "started"
  return (
    <section className="flex flex-col gap-5">
      <h1 className={cn(SERIF, "text-4xl")}>{event.name}</h1>
      {event.guest ? (
        <GuestJudgeDetails />
      ) : (
        <JudgeEventDetails event={event} />
      )}
      {closeAt && submissionsStillOpen(closeAt) ? (
        <p className="text-sm text-[#6E6E68]">
          This is available after the submission period is completed on{" "}
          {formatSubmissionDeadline(closeAt)}
        </p>
      ) : projects ? (
        <GuestProjectList eventSlug={slug} projects={projects} />
      ) : queue ? (
        <JudgeQueueList
          eventSlug={slug}
          queue={queue}
          startHref={
            started && event.briefing_acknowledged_at
              ? judgeContinuation(slug, queue)
              : null
          }
          briefingHref={
            started && !event.briefing_acknowledged_at
              ? judgeBriefingHref(slug)
              : null
          }
        />
      ) : (
        <p>
          Judge access unavailable. Your roster may have changed; contact an
          organizer.
        </p>
      )}
      {briefing && (
        <BriefingReader eventSlug={slug}>
          <JudgeScenario />
        </BriefingReader>
      )}
    </section>
  )
}
