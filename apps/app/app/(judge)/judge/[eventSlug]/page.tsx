import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { JudgeEventDetails } from "@/components/judge/event-details"
import { getJudgeEvent } from "@/lib/judge-access"

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
  return (
    <>
      <Link href="/judge" className="text-sm underline">
        Your judging events
      </Link>
      <h1 className={cn(SERIF, "text-4xl")}>{event.name}</h1>
      <JudgeEventDetails event={event} />
    </>
  )
}
