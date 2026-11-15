import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { JudgeEventDetails } from "@/components/judge/event-details"
import { getJudgeEvent } from "@/lib/judge-access"
import { getJudgeQueue } from "@/lib/judge-review-data"
import { JudgeQueueList } from "@/components/judge/queue"

export default async function JudgeEventPage({
  params,
}: PageProps<"/judge/[eventSlug]">) {
  const { eventSlug } = await params
  const event = await getJudgeEvent(eventSlug)
  if (!event)
    return (
      <>
        <h1 className={cn(SERIF, "text-4xl")}>Judge access unavailable</h1>
        <p className={cn(PAPER, "p-6")}>
          Your account does not have active verified judge access to this event.
          Ask an organizer to check your roster entry, then sign in again if
          your email changed.
        </p>
        <Link href="/judge" className="underline">
          Your judging events
        </Link>
      </>
    )
  const queue = await getJudgeQueue(eventSlug)
  return (
    <>
      <Link href="/judge" className="text-sm underline">
        Your judging events
      </Link>
      <h1 className={cn(SERIF, "text-4xl")}>{event.name}</h1>
      <JudgeEventDetails event={event} />
      {queue ? (
        <JudgeQueueList eventSlug={eventSlug} queue={queue} />
      ) : (
        <p>
          Judge access unavailable. Your roster may have changed; contact an
          organizer.
        </p>
      )}
    </>
  )
}
