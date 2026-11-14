import type { Database } from "@workspace/supabase/types"
import * as z from "zod"

const text = (max: number) =>
  z.string().trim().max(max, `Use ${max} characters or fewer`).default("")
const projectUrl = text(2048).refine((value) => {
  if (!value) return true
  if (/\s|\\/.test(value)) return false
  try {
    const url = new URL(value)
    return (
      ["http:", "https:"].includes(url.protocol) &&
      Boolean(url.host) &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}, "Enter an HTTP or HTTPS URL")

export const projectContentSchema = z
  .object({
    name: text(120),
    summary: text(300),
    description: text(10_000),
    technologies: text(1000),
    repository_url: projectUrl,
    demo_url: projectUrl,
    video_url: projectUrl,
  })
  .strict()

export const completeProjectContentSchema = projectContentSchema.superRefine(
  (value, ctx) => {
    for (const key of ["name", "summary", "description"] as const) {
      if (!value[key])
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "This field is required",
        })
    }
    if (!value.repository_url && !value.demo_url && !value.video_url) {
      ctx.addIssue({
        code: "custom",
        path: ["repository_url"],
        message: "Add at least one repository, demo, or video URL",
      })
    }
  }
)

export const projectSaveSchema = z
  .object({
    projectId: z.guid(),
    content: projectContentSchema,
    trackIds: z.array(z.guid()),
    submit: z.boolean(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()

export type ProjectContent = z.infer<typeof projectContentSchema>
export type ProjectSaveInput = z.input<typeof projectSaveSchema>
// SQL RETURNS TABLE metadata does not encode nullable output columns.
export type ProjectEvent = Omit<
  Database["public"]["Functions"]["participant_project_events"]["Returns"][number],
  | "project_submissions_open_at"
  | "project_submissions_close_at"
  | "judging_started_at"
> & {
  project_submissions_open_at: string | null
  project_submissions_close_at: string | null
  judging_started_at: string | null
}

export const projectDetailSchema = z.object({
  project: z.object({
    id: z.guid(),
    event_id: z.guid(),
    owner_user_id: z.guid(),
    name: z.string(),
    summary: z.string(),
    description: z.string(),
    technologies: z.string(),
    repository_url: z.string().nullable(),
    demo_url: z.string().nullable(),
    video_url: z.string().nullable(),
    status: z.enum(["draft", "submitted", "withdrawn"]),
    submitted_at: z.string().nullable(),
    updated_at: z.string(),
  }),
  collaborators: z.array(
    z.object({ user_id: z.guid(), full_name: z.string().nullable() })
  ),
  selected_tracks: z.array(
    z.object({ id: z.guid(), name: z.string(), active: z.boolean() })
  ),
  available_tracks: z.array(
    z.object({
      id: z.guid(),
      name: z.string(),
      description: z.string().nullable(),
      sponsor: z.string().nullable(),
    })
  ),
})

export type ProjectDetail = z.infer<typeof projectDetailSchema>
export type ProjectPhase =
  "disabled" | "scheduled" | "open" | "closed" | "judging"

export function projectPhase(
  event: ProjectEvent,
  now = Date.now()
): ProjectPhase {
  if (event.judging_started_at) return "judging"
  if (!event.enabled || !event.project_submissions_open_at) return "disabled"
  if (
    event.project_submissions_close_at &&
    now >= Date.parse(event.project_submissions_close_at)
  )
    return "closed"
  return now < Date.parse(event.project_submissions_open_at)
    ? "scheduled"
    : "open"
}

export function canManageProject(event: ProjectEvent, now = Date.now()) {
  return (
    event.eligible && ["scheduled", "open"].includes(projectPhase(event, now))
  )
}

export function projectContent(detail: ProjectDetail): ProjectContent {
  return {
    name: detail.project.name,
    summary: detail.project.summary,
    description: detail.project.description,
    technologies: detail.project.technologies,
    repository_url: detail.project.repository_url ?? "",
    demo_url: detail.project.demo_url ?? "",
    video_url: detail.project.video_url ?? "",
  }
}

export function fieldErrors(issues: z.core.$ZodIssue[]) {
  const errors: Record<string, string> = {}
  for (const issue of issues) {
    const path =
      issue.path.filter((part) => part !== "content").join(".") || "form"
    errors[path] ??= issue.message
  }
  return errors
}

export function projectFailure(error: {
  code?: string
  message: string
  details?: string | null
}) {
  if (error.code === "PT422" && error.details) {
    try {
      const parsed = z
        .record(z.string(), z.string())
        .safeParse(JSON.parse(error.details))
      if (parsed.success)
        return { error: error.message, fieldErrors: parsed.data }
    } catch {
      /* Preserve the ordinary database error if details are malformed. */
    }
  }
  return { error: error.message }
}
