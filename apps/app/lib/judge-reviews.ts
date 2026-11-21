import { projectQuestionAnswerSchema } from "@workspace/forms"
import * as z from "zod"

export const SCORE_MIN = 1
export const SCORE_MAX = 5
export const SCORE_STEP = 0.1

export const scoreSchema = z
  .number()
  .min(SCORE_MIN)
  .max(SCORE_MAX)
  .refine(
    (value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9,
    "Use steps of 0.1"
  )
export const reviewScoresSchema = z.record(z.guid(), scoreSchema.nullable())
export const judgeRouteSchema = z.object({
  eventSlug: z.string().regex(/^[A-Za-z0-9_-]+$/),
  assignmentId: z.guid(),
})
export const reviewSaveSchema = judgeRouteSchema
  .extend({
    scores: reviewScoresSchema,
    notes: z.string().max(5000, "Use 5000 characters or fewer"),
    submit: z.boolean(),
  })
  .strict()
export const judgeCriterionSchema = z.object({
  id: z.guid(),
  name: z.string(),
  description: z.string(),
})
export const judgeCriteriaSchema = z.array(judgeCriterionSchema)
export const judgeScorecardSchema = z.object({
  id: z.guid(),
  track_id: z.guid().nullable(),
  track_name: z.string().nullable(),
  scores: z.record(z.guid(), scoreSchema),
  notes: z.string(),
  submitted_at: z.string().nullable(),
})
export const judgeQueueSchema = z.object({
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  assignments: z.array(
    z.object({
      id: z.guid(),
      project_name: z.string(),
      track_id: z.guid().nullable(),
      track_name: z.string().nullable(),
      submitted_at: z.string().nullable(),
      in_progress: z.boolean(),
    })
  ),
})
export const judgeAssignmentSchema = z.object({
  assignment: judgeScorecardSchema,
  project: z.object({ name: z.string() }),
  criteria: judgeCriteriaSchema,
  answers: z.array(projectQuestionAnswerSchema),
  team: z.array(z.string().nullable()),
})
export type ReviewScores = z.infer<typeof reviewScoresSchema>
export type JudgeCriterion = z.infer<typeof judgeCriterionSchema>
export type JudgeScorecard = z.infer<typeof judgeScorecardSchema>
export type JudgeQueue = z.infer<typeof judgeQueueSchema>
export type JudgeAssignment = z.infer<typeof judgeAssignmentSchema>

export function reviewScores(
  assignment: JudgeScorecard,
  criteria: JudgeCriterion[]
): ReviewScores {
  return Object.fromEntries(
    criteria.map(({ id }) => [id, assignment.scores[id] ?? null])
  )
}
export function reviewComplete(scores: ReviewScores) {
  const values = Object.values(scores)
  return values.length > 0 && values.every((value) => value !== null)
}
export function reviewAverage(scores: ReviewScores) {
  const values = Object.values(scores)
  if (!reviewComplete(scores)) return null
  return values.reduce<number>((sum, value) => sum + value!, 0) / values.length
}
export function formatScore(value: number) {
  return value.toFixed(1)
}
export function judgeAssignmentHref(eventSlug: string, id: string) {
  return `/judge/${encodeURIComponent(eventSlug)}/${encodeURIComponent(id)}`
}
export function judgeBriefingHref(eventSlug: string) {
  return `/judge/${encodeURIComponent(eventSlug)}/briefing`
}
export function judgeContinuation(
  eventSlug: string,
  queue: JudgeQueue,
  afterId?: string
) {
  const start = queue.assignments.findIndex(({ id }) => id === afterId) + 1
  const ordered = [
    ...queue.assignments.slice(start),
    ...queue.assignments.slice(0, start),
  ]
  const next = ordered.find((assignment) => !assignment.submitted_at)
  return next ? judgeAssignmentHref(eventSlug, next.id) : "/judge"
}
export function queuePosition(
  eventSlug: string,
  queue: JudgeQueue,
  id: string
) {
  const index = queue.assignments.findIndex(
    (assignment) => assignment.id === id
  )
  if (index === -1) return null
  const href = (offset: number) => {
    const target = queue.assignments[index + offset]
    return target ? judgeAssignmentHref(eventSlug, target.id) : null
  }
  return {
    number: index + 1,
    total: queue.assignments.length,
    previous: href(-1),
    next: href(1),
  }
}
export function reviewContext(assignment: {
  track_id: string | null
  track_name: string | null
}) {
  return assignment.track_id
    ? `Sponsor track: ${assignment.track_name ?? "Unnamed track"}`
    : "General judging"
}
