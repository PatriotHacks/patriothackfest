import * as z from "zod"

export const assignmentEventInput = z.object({ eventId: z.guid() }).strict()

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
export const assignmentOverview = z.object({ missing: count })
export type AssignmentOverview = z.infer<typeof assignmentOverview>
export type GenerationSummary = z.infer<typeof generationSummary>
export type RebalancePlan = z.infer<typeof rebalancePlan>

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
