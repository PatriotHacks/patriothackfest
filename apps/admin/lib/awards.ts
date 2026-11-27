import * as z from "zod"

import { projectStatusSchema } from "./organizer-projects"

export const MAX_AWARD_RANK = 1000

export const adminAwardsSchema = z.object({
  awards: z.array(
    z.object({
      id: z.guid(),
      name: z.string(),
      rank: z.number().int(),
      track_id: z.guid().nullable(),
      projects: z.array(
        z.object({
          id: z.guid(),
          name: z.string(),
          status: projectStatusSchema,
        })
      ),
    })
  ),
  projects: z.array(
    z.object({
      id: z.guid(),
      name: z.string(),
      track_ids: z.array(z.guid()),
    })
  ),
})

export type AdminAwards = z.infer<typeof adminAwardsSchema>
export type AdminAward = AdminAwards["awards"][number]
export type AwardCandidate = AdminAwards["projects"][number]

export const awardInput = z
  .object({
    eventId: z.guid(),
    awardId: z.guid().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Enter an award name")
      .max(120, "Use 120 characters or fewer"),
    rank: z
      .number()
      .int("Rank must be a whole number")
      .min(1, "Rank must be at least 1")
      .max(MAX_AWARD_RANK, `Rank must be at most ${MAX_AWARD_RANK}`),
    trackId: z.guid().nullable(),
  })
  .strict()

export type AwardInput = z.infer<typeof awardInput>

export const awardProjectInput = z
  .object({ eventId: z.guid(), awardId: z.guid(), projectId: z.guid() })
  .strict()

export type AwardProjectInput = z.infer<typeof awardProjectInput>

export function awardCandidates(
  award: Pick<AdminAward, "track_id" | "projects">,
  projects: AwardCandidate[]
) {
  const assigned = new Set(award.projects.map((project) => project.id))
  return projects.filter(
    (project) =>
      !assigned.has(project.id) &&
      (award.track_id === null || project.track_ids.includes(award.track_id))
  )
}
