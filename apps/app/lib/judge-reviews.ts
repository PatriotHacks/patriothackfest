import { projectQuestionAnswerSchema } from "@workspace/forms"
import * as z from "zod"

export const reviewCriteria = [
  { key: "creativity_score", label: "Creativity" },
  { key: "technical_score", label: "Technical execution" },
  { key: "impact_score", label: "Impact/usefulness" },
  { key: "presentation_score", label: "Presentation/demo" },
] as const

const score = z.number().int().min(1).max(5).nullable()
export const reviewScoresSchema = z
  .object({
    creativity_score: score,
    technical_score: score,
    impact_score: score,
    presentation_score: score,
  })
  .strict()
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
  .superRefine((value, ctx) => {
    if (value.submit)
      for (const { key } of reviewCriteria) {
        if (value.scores[key] === null)
          ctx.addIssue({
            code: "custom",
            path: ["scores", key],
            message: "Choose a score to submit",
          })
      }
  })
export const judgeScorecardSchema = reviewScoresSchema.extend({
  id: z.guid(),
  track_id: z.guid().nullable(),
  track_name: z.string().nullable(),
  notes: z.string(),
  total_score: z.number().int().min(4).max(20).nullable(),
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
  project: z.object({
    name: z.string(),
    summary: z.string(),
    description: z.string(),
    technologies: z.string(),
    repository_url: z.string().nullable(),
    demo_url: z.string().nullable(),
    video_url: z.string().nullable(),
  }),
  answers: z.array(projectQuestionAnswerSchema),
})
export type ReviewScores = z.infer<typeof reviewScoresSchema>
export type JudgeScorecard = z.infer<typeof judgeScorecardSchema>
export type JudgeQueue = z.infer<typeof judgeQueueSchema>
export type JudgeAssignment = z.infer<typeof judgeAssignmentSchema>

export function reviewScores(assignment: JudgeScorecard): ReviewScores {
  return Object.fromEntries(
    reviewCriteria.map(({ key }) => [key, assignment[key]])
  ) as ReviewScores
}
export function judgeAssignmentHref(eventSlug: string, id: string) {
  return `/judge/${encodeURIComponent(eventSlug)}/${encodeURIComponent(id)}`
}
export function judgeContinuation(eventSlug: string, queue: JudgeQueue) {
  const next = queue.assignments.find((assignment) => !assignment.submitted_at)
  return next
    ? judgeAssignmentHref(eventSlug, next.id)
    : `/judge/${encodeURIComponent(eventSlug)}`
}
export function reviewContext(assignment: {
  track_id: string | null
  track_name: string | null
}) {
  return assignment.track_id
    ? `Sponsor track: ${assignment.track_name ?? "Unnamed track"}`
    : "General judging"
}
