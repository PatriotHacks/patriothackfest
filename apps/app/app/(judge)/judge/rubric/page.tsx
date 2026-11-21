import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import { JudgeScenario } from "@/components/judge/scenario"
import { getJudgeEvent, getJudgeEvents } from "@/lib/judge-access"
import { getJudgeCriteria } from "@/lib/judge-review-data"
import { formatScore, SCORE_MAX, SCORE_MIN } from "@/lib/judge-reviews"

export default async function JudgeRubricPage() {
  const events = await getJudgeEvents()
  return (
    <>
      <h1 className={cn(SERIF, "text-4xl")}>Rubric</h1>
      {events.map((event) => (
        <EventCriteria key={event.event_id} slug={event.slug} />
      ))}
      <section className={cn(PAPER, "p-6")}>
        <JudgeScenario />
      </section>
    </>
  )
}

async function EventCriteria({ slug }: { slug: string }) {
  const event = await getJudgeEvent(slug)
  if (!event) return null
  const criteria = event.judging_started_at
    ? await getJudgeCriteria(slug)
    : null
  return (
    <section className={cn(PAPER, "flex flex-col gap-4 p-6")}>
      <h2 className="text-xl font-semibold">{event.name} scoring criteria</h2>
      {criteria ? (
        <>
          <p className="text-sm text-[#6E6E68]">
            Score each criterion from {formatScore(SCORE_MIN)} to{" "}
            {formatScore(SCORE_MAX)} in steps of 0.1. Your score for a project
            is the average of your criterion scores.
          </p>
          <ol className="flex list-outside list-decimal flex-col gap-3 pl-5">
            {criteria.map((criterion) => (
              <li key={criterion.id}>
                <p className="font-semibold break-words">{criterion.name}</p>
                {criterion.description && (
                  <p className="text-sm whitespace-pre-line">
                    {criterion.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p>The rubric will appear here when judging starts.</p>
      )}
    </section>
  )
}
