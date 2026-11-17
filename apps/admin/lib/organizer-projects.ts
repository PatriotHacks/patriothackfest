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

export const submittedProjectsSchema = z.object({
  projects: z
    .array(
      z.object({
        id: z.guid(),
        name: z.string(),
        submitted_at: timestamp,
        owner: personSchema,
        tracks: z.array(trackSchema),
      })
    )
    .max(PROJECT_PAGE_SIZE),
  has_more: z.boolean(),
})

export const submittedProjectDetailSchema = z.object({
  project: z.object({
    id: z.guid(),
    event_id: z.guid(),
    status: z.literal("submitted"),
    name: z.string(),
    summary: z.string(),
    description: z.string(),
    technologies: z.string(),
    repository_url: z.string().nullable(),
    demo_url: z.string().nullable(),
    video_url: z.string().nullable(),
    submitted_at: timestamp,
    updated_at: timestamp,
  }),
  owner: personSchema,
  collaborators: z.array(personSchema),
  tracks: z.array(trackSchema),
  answers: z.array(projectQuestionAnswerSchema),
})

export type SubmittedProjects = z.infer<typeof submittedProjectsSchema>
export type SubmittedProjectDetail = z.infer<
  typeof submittedProjectDetailSchema
>

export function parseProjectsPage(value: unknown) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return 1
  const parsed = projectPageSchema.safeParse(Number(value))
  return parsed.success ? parsed.data : 1
}

export function submittedProjectsHref(eventSlug: string, page: number) {
  return `/submission-forms?${new URLSearchParams({ event: eventSlug, projectsPage: String(page) })}#submitted-projects`
}

export function submittedProjectHref(
  eventSlug: string,
  projectId: string,
  page: number
) {
  return `/submission-forms/projects/${encodeURIComponent(projectId)}?${new URLSearchParams({ event: eventSlug, projectsPage: String(page) })}`
}

export function projectPersonLabel(person: {
  id: string
  full_name: string | null
}) {
  return (
    person.full_name?.trim() || `Unnamed participant (${person.id.slice(-8)})`
  )
}

export function safeProjectUrl(value: string | null): string | null {
  const candidate = value?.trim()
  if (!candidate || /\s|\\/.test(candidate)) return null
  try {
    const url = new URL(candidate)
    return ["http:", "https:"].includes(url.protocol) &&
      url.host &&
      !url.username &&
      !url.password
      ? candidate
      : null
  } catch {
    return null
  }
}
