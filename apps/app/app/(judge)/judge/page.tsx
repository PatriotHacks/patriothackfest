import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import { JudgeEventDetails } from "@/components/judge/event-details"
import { JudgeQueueList } from "@/components/judge/queue"
import {
  getJudgeEvent,
  getJudgeEvents,
  getProjectSubmissionsCloseAt,
} from "@/lib/judge-access"
import { getJudgeQueue } from "@/lib/judge-review-data"
import {
  formatSubmissionDeadline,
  submissionsStillOpen,
} from "@/lib/judge-status"

export default async function JudgeDashboardPage() {
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
    <JudgeEventSection key={event.event_id} slug={event.slug} />
  ))
}

async function JudgeEventSection({ slug }: { slug: string }) {
  const event = await getJudgeEvent(slug)
  if (!event)
    return (
      <p className={cn(PAPER, "p-6")}>
        Judge access unavailable. Your roster may have changed; contact an
        organizer.
      </p>
    )
  const [queue, closeAt] = await Promise.all([
    getJudgeQueue(slug),
    getProjectSubmissionsCloseAt(event.event_id),
  ])
  return (
    <section className="flex flex-col gap-5">
      <h1 className={cn(SERIF, "text-4xl")}>{event.name}</h1>
      <JudgeEventDetails event={event} />
      {closeAt && submissionsStillOpen(closeAt) ? (
        <p className="text-sm text-[#6E6E68]">
          This is available after the submission period is completed on{" "}
          {formatSubmissionDeadline(closeAt)}
        </p>
      ) : queue ? (
        <JudgeQueueList eventSlug={slug} queue={queue} />
      ) : (
        <p>
          Judge access unavailable. Your roster may have changed; contact an
          organizer.
        </p>
      )}
    </section>
  )
}
