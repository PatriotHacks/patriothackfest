import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BriefingReader } from "@/components/judge/briefing-reader"
import { JudgeScenario } from "@/components/judge/scenario"
import { getJudgeEvent } from "@/lib/judge-access"
import { judgeRouteSchema } from "@/lib/judge-reviews"

export default async function JudgeBriefingPage({
  params,
}: PageProps<"/judge/[eventSlug]/briefing">) {
  const { eventSlug } = await params
  if (!judgeRouteSchema.shape.eventSlug.safeParse(eventSlug).success) notFound()
  const event = await getJudgeEvent(eventSlug)
  return (
    <>
      <Link className="text-sm underline" href="/judge">
        Back to dashboard
      </Link>
      {event ? (
        <>
          <p className="text-sm">{event.name}</p>
          <h1 className={cn(SERIF, "text-4xl")}>Before you judge</h1>
          <BriefingReader
            eventSlug={eventSlug}
            acknowledged={Boolean(event.briefing_acknowledged_at)}
          >
            <JudgeScenario />
          </BriefingReader>
        </>
      ) : (
        <section className={cn(PAPER, "p-6")}>
          <h1 className={cn(SERIF, "text-3xl")}>Judge access unavailable</h1>
          <p>
            Your roster may have changed. Return to your dashboard or contact an
            organizer.
          </p>
        </section>
      )}
    </>
  )
}
