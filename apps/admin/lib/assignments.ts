import * as z from "zod"

export const assignmentStatus = z.enum([
  "all",
  "untouched",
  "in_progress",
  "submitted",
  "cancelled",
])
export const assignmentPage = z.number().int().min(1).max(2_147_483_647)
export const assignmentFilters = z
  .object({
    coveragePage: assignmentPage.default(1),
    assignmentPage: assignmentPage.default(1),
    projectId: z.guid().optional(),
    status: assignmentStatus.default("all"),
  })
  .strict()
export type AssignmentFilters = z.infer<typeof assignmentFilters>

export function parseAssignmentQuery(
  query: Record<string, unknown>
): AssignmentFilters {
  const page = (value: unknown) => {
    if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return 1
    const parsed = assignmentPage.safeParse(Number(value))
    return parsed.success ? parsed.data : 1
  }
  return assignmentFilters.parse({
    coveragePage: page(query.coveragePage),
    assignmentPage: page(query.assignmentPage),
    projectId: z.guid().safeParse(query.assignmentProject).success
      ? (query.assignmentProject as string)
      : undefined,
    status: assignmentStatus.catch("all").parse(query.assignmentStatus),
  })
}

export const assignmentEventInput = z.object({ eventId: z.guid() }).strict()
export const assignmentContextInput = assignmentEventInput
  .extend({
    projectId: z.guid(),
    trackId: z.guid().nullable(),
  })
  .strict()
export const addAssignmentInput = assignmentContextInput
  .extend({ judgeId: z.guid() })
  .strict()
export const cancelAssignmentInput = assignmentEventInput
  .extend({ assignmentId: z.guid() })
  .strict()
export const reassignAssignmentInput = cancelAssignmentInput
  .extend({ judgeId: z.guid() })
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
export const assignmentCandidates = z.array(
  z.object({
    judge_id: z.guid(),
    email: z.string(),
    workload: count,
    capacity: count,
  })
)
export const assignmentOverview = z.object({
  missing: count,
  coverage_has_more: z.boolean(),
  assignments_has_more: z.boolean(),
  coverage: z
    .array(
      z.object({
        project_id: z.guid(),
        project_name: z.string(),
        track_id: z.guid().nullable(),
        track_name: z.string().nullable(),
        target: count,
        assigned: count,
        missing: count,
      })
    )
    .max(50),
  assignments: z
    .array(
      z.object({
        id: z.guid(),
        project_id: z.guid(),
        project_name: z.string(),
        judge_id: z.guid(),
        judge_email: z.string(),
        judge_active: z.boolean(),
        track_id: z.guid().nullable(),
        track_name: z.string().nullable(),
        status: assignmentStatus.exclude(["all"]),
      })
    )
    .max(50),
})
export type AssignmentOverview = z.infer<typeof assignmentOverview>
export type AssignmentCandidate = z.infer<typeof assignmentCandidates>[number]
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

export function assignmentContextLabel(trackName: string | null) {
  return trackName === null ? "General" : `Sponsor: ${trackName}`
}

export function assignmentQueryParams(
  filters: AssignmentFilters
): Record<string, string> {
  return {
    coveragePage: String(filters.coveragePage),
    assignmentPage: String(filters.assignmentPage),
    assignmentStatus: filters.status,
    ...(filters.projectId ? { assignmentProject: filters.projectId } : {}),
  }
}

export function assignmentHref(
  eventSlug: string,
  filters: AssignmentFilters,
  projectsPage: number,
  preserved: Record<string, string> = {}
) {
  const params = new URLSearchParams({
    ...preserved,
    event: eventSlug,
    projectsPage: String(projectsPage),
    ...assignmentQueryParams(filters),
  })
  return `/judging?${params}#assignments`
}
