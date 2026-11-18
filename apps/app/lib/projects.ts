import {
  editableProjectAnswer,
  fileAnswer,
  fileAnswerSchema,
  MAX_PROJECT_ANSWER_LENGTH,
  normalizedProjectAnswer,
  projectQuestionSchema,
  type ProjectAnswer,
} from "@workspace/forms"
import type { Database } from "@workspace/supabase/types"
import * as z from "zod"

const name = z.string().trim().max(120, "Use 120 characters or fewer")
export const projectContentSchema = z
  .object({ name: name.default("") })
  .strict()

export const completeProjectContentSchema = projectContentSchema.refine(
  (value) => Boolean(value.name),
  { path: ["name"], message: "This field is required" }
)

const answersSchema = z.record(
  z.guid(),
  z
    .union([
      z.string().trim().max(MAX_PROJECT_ANSWER_LENGTH),
      z.array(z.guid()).max(50),
      fileAnswerSchema,
    ])
    .nullable()
)

export const projectSaveSchema = z
  .object({
    projectId: z.guid(),
    eventId: z.guid(),
    content: projectContentSchema,
    answers: answersSchema,
    trackIds: z.array(z.guid()),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()

export const projectSubmitSchema = z
  .object({
    projectId: z.guid(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()

export const projectPatchSchema = z
  .object({
    projectId: z.guid(),
    name: name.optional(),
    answers: answersSchema,
    trackIds: z.array(z.guid()).optional(),
  })
  .strict()

export const projectPatchResultSchema = z.object({
  updated_at: z.string(),
  name: z.string(),
  answers: z.record(z.string(), z.unknown()),
  removed_paths: z.array(z.string()),
})

export type ProjectContent = z.infer<typeof projectContentSchema>
export type ProjectAnswers = Record<string, ProjectAnswer>
export type ProjectSaveInput = z.input<typeof projectSaveSchema>
export type ProjectPatchInput = z.input<typeof projectPatchSchema>
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

const teamMemberSchema = z.object({
  user_id: z.guid(),
  full_name: z.string().nullable(),
})

export const projectDetailSchema = z.object({
  project: z.object({
    id: z.guid(),
    event_id: z.guid(),
    owner_user_id: z.guid(),
    name: z.string(),
    status: z.enum(["draft", "submitted", "withdrawn"]),
    submitted_at: z.string().nullable(),
    updated_at: z.string(),
    answers: z.record(z.string(), z.unknown()),
  }),
  owner: teamMemberSchema,
  collaborators: z.array(teamMemberSchema),
  max_team_size: z.number().int().positive().nullable(),
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
  questions: z.array(projectQuestionSchema),
})

export type ProjectDetail = z.infer<typeof projectDetailSchema>
export type TeamMember = z.infer<typeof teamMemberSchema> & { owner: boolean }

export function teamMembers(detail: ProjectDetail): TeamMember[] {
  return [
    { ...detail.owner, owner: true },
    ...detail.collaborators.map((person) => ({ ...person, owner: false })),
  ]
}

export function memberName(fullName: string | null) {
  return fullName?.trim() || "Unnamed participant"
}

export const STALE_PROJECT_MESSAGE =
  "Someone else saved this project after you opened it. Copy any unsaved text, then reload the page to see the latest version."
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
  return { name: detail.project.name }
}

export function projectAnswers(detail: ProjectDetail): ProjectAnswers {
  return Object.fromEntries(
    detail.questions.map((question) => [
      question.id,
      editableProjectAnswer(question, detail.project.answers[question.id]),
    ])
  )
}

function filePaths(answers: Record<string, unknown>) {
  return Object.values(answers)
    .map((value) => fileAnswer(value)?.path)
    .filter((path) => path !== undefined)
}

export function replacedFilePaths(
  projectId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  const kept = new Set(filePaths(after))
  return filePaths(before).filter(
    (path) => !kept.has(path) && path.startsWith(`${projectId}/`)
  )
}

export function normalizedProjectAnswers(
  answers: ProjectAnswers
): ProjectAnswers {
  return Object.fromEntries(
    Object.entries(answers).map(([key, value]) => [
      key,
      normalizedProjectAnswer(value),
    ])
  )
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
}): { error: string; fieldErrors?: Record<string, string>; stale?: true } {
  if (error.code === "PT409")
    return { error: STALE_PROJECT_MESSAGE, stale: true }
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

export function retryableStatus(status: number) {
  return status === 0 || status >= 500
}
