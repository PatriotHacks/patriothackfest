import * as z from "zod"

import { parseProjectsPage, projectPageSchema } from "./organizer-projects"

export const resultsFilters = z
  .object({
    trackId: z.guid().toLowerCase().nullable().default(null),
    page: projectPageSchema.default(1),
  })
  .strict()
export type ResultsFilters = z.infer<typeof resultsFilters>

export function parseResultsQuery(query: Record<string, unknown>) {
  const track = query.resultsTrack
  const general = track === undefined || track === "general"
  const valid = z.guid().safeParse(track)
  return {
    filters: {
      trackId: general || !valid.success ? null : valid.data.toLowerCase(),
      page: parseProjectsPage(query.resultsPage),
    },
    invalidContext: !general && !valid.success,
  }
}

export const judgingResults = z
  .object({
    track_id: z.guid().nullable(),
    track_name: z.string().nullable(),
    target: z.number().int().min(1).max(20).nullable(),
    has_more: z.boolean(),
    projects: z
      .array(
        z
          .object({
            project_id: z.guid(),
            project_name: z.string(),
            completed: z.number().int().nonnegative(),
            average_total: z.number().min(4).max(20).nullable(),
            insufficient_coverage: z.boolean(),
            tied: z.boolean(),
          })
          .refine(
            (row) =>
              (row.completed === 0) === (row.average_total === null) &&
              (row.completed > 0 || !row.tied),
            "Only completed reviews have averages or ties"
          )
      )
      .max(50),
  })
  .refine(
    (data) => (data.track_id === null) === (data.track_name === null),
    "Context identity and label must agree"
  )
  .refine(
    (data) =>
      data.target === null
        ? data.projects.length === 0 && !data.has_more && data.track_id === null
        : data.projects.every(
            (row) => row.insufficient_coverage === row.completed < data.target!
          ),
    "Coverage must match the current context target"
  )
export type JudgingResults = z.infer<typeof judgingResults>

export function resultsQueryParams(filters: ResultsFilters) {
  return {
    resultsTrack: filters.trackId ?? "general",
    resultsPage: String(filters.page),
  }
}

export function resultsHref(
  eventSlug: string,
  filters: ResultsFilters,
  preserved: Record<string, string> = {}
) {
  const params = new URLSearchParams({
    ...preserved,
    event: eventSlug,
    ...resultsQueryParams(filters),
  })
  return `/judging?${params}#results`
}

export function formatResultAverage(average: number | null) {
  return average === null ? "No reviews" : `${average.toFixed(2)} / 20`
}
