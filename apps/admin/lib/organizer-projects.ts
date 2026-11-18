import { projectQuestionAnswerSchema } from "@workspace/forms"
import * as z from "zod"

export const PROJECT_PAGE_SIZE = 50
export const projectPageSchema = z.number().int().min(1).max(2_147_483_647)

const personSchema = z.object({
  id: z.guid(),
  full_name: z.string().nullable(),
})
const trackSchema = z.object({
  id: z.guid(),
  name: z.string(),
  active: z.boolean(),
})
const timestamp = z.iso.datetime({ offset: true })

export const projectStatusSchema = z.enum(["draft", "submitted", "withdrawn"])
export type ProjectStatus = z.infer<typeof projectStatusSchema>
const count = z.number().int().min(0)

export const eventProjectsSchema = z.object({
  projects: z
    .array(
      z.object({
        id: z.guid(),
        name: z.string(),
        status: projectStatusSchema,
        submitted_at: timestamp.nullable(),
        updated_at: timestamp,
        owner: personSchema,
        answered_count: count,
      })
    )
    .max(PROJECT_PAGE_SIZE),
  has_more: z.boolean(),
  required_count: count,
  counts: z.object({ draft: count, submitted: count, withdrawn: count }),
})

export const projectDetailSchema = z.object({
  project: z.object({
    id: z.guid(),
    event_id: z.guid(),
    status: projectStatusSchema,
    name: z.string(),
    submitted_at: timestamp.nullable(),
    updated_at: timestamp,
  }),
  owner: personSchema,
  collaborators: z.array(personSchema),
  tracks: z.array(trackSchema),
  answers: z.array(projectQuestionAnswerSchema),
})

export type EventProjects = z.infer<typeof eventProjectsSchema>
export type ProjectDetail = z.infer<typeof projectDetailSchema>
export type ProjectTrack = ProjectDetail["tracks"][number]
export type ProjectsQuery = { status: ProjectStatus | null; page: number }

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  withdrawn: "Withdrawn",
}

export function parseProjectsPage(value: unknown) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return 1
  const parsed = projectPageSchema.safeParse(Number(value))
  return parsed.success ? parsed.data : 1
}

export function parseProjectStatus(value: unknown) {
  const parsed = projectStatusSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function projectsQueryParams(eventSlug: string, query: ProjectsQuery) {
  const params = new URLSearchParams({ event: eventSlug })
  if (query.status) params.set("status", query.status)
  params.set("projectsPage", String(query.page))
  return params
}

export function projectsHref(eventSlug: string, query: ProjectsQuery) {
  return `/project-submissions?${projectsQueryParams(eventSlug, query)}`
}

export function projectHref(
  eventSlug: string,
  projectId: string,
  query: ProjectsQuery
) {
  return `/project-submissions/${encodeURIComponent(projectId)}?${projectsQueryParams(eventSlug, query)}`
}

export function projectPersonLabel(person: {
  id: string
  full_name: string | null
}) {
  return (
    person.full_name?.trim() || `Unnamed participant (${person.id.slice(-8)})`
  )
}
