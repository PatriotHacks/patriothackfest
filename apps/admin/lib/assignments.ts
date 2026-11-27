import * as z from "zod"

export const assignmentEventInput = z.object({ eventId: z.guid() }).strict()
export const assignRemainingInput = z
  .object({ eventId: z.guid(), judgeId: z.guid() })
  .strict()

const count = z.number().int().nonnegative()
export const generationSummary = z.object({ created: count, missing: count })
export const rebalancePlan = z.object({
  moved: count,
  spread: count,
  transfers: z.array(
    z.object({
      from_judge_id: z.guid(),
      from_email: z.string(),
      to_judge_id: z.guid(),
      to_email: z.string(),
      count,
    })
  ),
})
export const assignRemainingPlan = z.object({
  moved: count,
  skipped: z.object({
    conflict: count,
    ineligible_track: count,
    capacity: count,
    previously_held: count,
  }),
  sources: z.array(z.object({ judge_id: z.guid(), email: z.string(), count })),
})
export const assignmentOverview = z.object({ missing: count })
export type AssignmentOverview = z.infer<typeof assignmentOverview>
export type GenerationSummary = z.infer<typeof generationSummary>
export type RebalancePlan = z.infer<typeof rebalancePlan>
export type AssignRemainingPlan = z.infer<typeof assignRemainingPlan>

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

function spreadNote(spread: number) {
  return spread > 1
    ? ` The busiest and least busy judges still differ by ${plural(spread, "assignment")}; the rest is started, submitted, or has no eligible judge with room.`
    : ""
}

export function rebalancePreviewMessage(plan: RebalancePlan) {
  if (plan.moved === 0)
    return `No assignments can be moved.${spreadNote(plan.spread)}`
  return `${plural(plan.moved, "untouched assignment")} will move.${spreadNote(plan.spread)}`
}

export function rebalanceResultMessage(plan: RebalancePlan) {
  return `Moved ${plural(plan.moved, "assignment")}.${spreadNote(plan.spread)}`
}

function skippedNote({ skipped }: AssignRemainingPlan) {
  const parts = [
    [skipped.capacity, "over the judge's capacity"],
    [skipped.conflict, "on the judge's own team"],
    [skipped.ineligible_track, "outside the judge's tracks"],
    [skipped.previously_held, "already held by the judge"],
  ] as const
  const listed = parts.filter(([n]) => n > 0).map(([n, why]) => `${n} ${why}`)
  return listed.length ? ` Skipped: ${listed.join(", ")}.` : ""
}

export function assignRemainingPreviewMessage(plan: AssignRemainingPlan) {
  if (plan.moved === 0)
    return `No assignments can be moved.${skippedNote(plan)}`
  return `${plural(plan.moved, "untouched assignment")} will move.${skippedNote(plan)}`
}

export function assignRemainingResultMessage(plan: AssignRemainingPlan) {
  return `Moved ${plural(plan.moved, "assignment")}.${skippedNote(plan)}`
}
