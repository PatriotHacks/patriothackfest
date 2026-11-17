import * as z from "zod"

import {
  DEFAULT_FILE_MAX_SIZE_MB,
  fileAnswerSchema,
  FIELD_TYPE_LABELS,
  MAX_FILE_SIZE_MB,
  type FileAnswer,
} from "./schema"

export const PROJECT_QUESTION_TYPES = [
  "short_text",
  "long_text",
  "url",
  "single_choice",
  "multiple_choice",
  "file",
] as const

export const projectQuestionTypeSchema = z.enum(PROJECT_QUESTION_TYPES)
export type ProjectQuestionType = z.infer<typeof projectQuestionTypeSchema>

export const PROJECT_QUESTION_TYPE_LABELS = Object.fromEntries(
  PROJECT_QUESTION_TYPES.map((type) => [type, FIELD_TYPE_LABELS[type]])
) as Record<ProjectQuestionType, string>

export const PROJECT_FILES_BUCKET = "project-files"
export const DEFAULT_PROJECT_ANSWER_LENGTH = 5000
export const MAX_PROJECT_ANSWER_LENGTH = 10_000
export const MAX_PROJECT_URL_LENGTH = 2048

export function isProjectTextType(type: ProjectQuestionType) {
  return type === "short_text" || type === "long_text"
}

export function isProjectChoiceType(type: ProjectQuestionType) {
  return type === "single_choice" || type === "multiple_choice"
}

export const choiceOptionSchema = z.object({
  id: z.guid(),
  label: z.string(),
})
export type ChoiceOption = z.infer<typeof choiceOptionSchema>

export const projectFileValidationSchema = z
  .object({ max_size_mb: z.number().positive().max(MAX_FILE_SIZE_MB) })
  .partial()

export const projectQuestionSchema = z.object({
  id: z.guid(),
  label: z.string(),
  help_text: z.string().nullable(),
  required: z.boolean(),
  type: projectQuestionTypeSchema,
  max_length: z.number().int().positive().nullable(),
  options: z.array(choiceOptionSchema).nullable(),
  validation: projectFileValidationSchema.nullable(),
})
export type ProjectQuestion = z.infer<typeof projectQuestionSchema>

export const adminProjectQuestionSchema = projectQuestionSchema.extend({
  archived_options: z.array(choiceOptionSchema).nullable(),
  answered: z.boolean(),
})
export type AdminProjectQuestion = z.infer<typeof adminProjectQuestionSchema>

export function knownOptions(
  question: Pick<AdminProjectQuestion, "options" | "archived_options">
) {
  return [...(question.options ?? []), ...(question.archived_options ?? [])]
}

export const projectAnswerSchema = z
  .union([z.string(), z.array(z.string()), fileAnswerSchema])
  .nullable()
export type ProjectAnswer = z.infer<typeof projectAnswerSchema>

export const projectQuestionAnswerSchema = z.object({
  question_id: z.guid(),
  label: z.string(),
  type: projectQuestionTypeSchema,
  options: z.array(choiceOptionSchema).nullable(),
  answer: projectAnswerSchema,
})
export type ProjectQuestionAnswer = z.infer<typeof projectQuestionAnswerSchema>

export function projectFilePath(parts: {
  projectId: string
  questionId: string
  fileId: string
}) {
  return `${parts.projectId}/${parts.questionId}/${parts.fileId}.pdf`
}

export function projectFileMaxSizeMb(
  question: Pick<ProjectQuestion, "validation">
) {
  return Math.min(
    question.validation?.max_size_mb ?? DEFAULT_FILE_MAX_SIZE_MB,
    MAX_FILE_SIZE_MB
  )
}

function optionIds(options: ChoiceOption[] | null) {
  return new Set((options ?? []).map((option) => option.id))
}

function labelKey(label: string) {
  return label.trim().toLowerCase()
}

export function reuseOptionIds(
  options: ChoiceOption[],
  saved: ChoiceOption[]
): ChoiceOption[] {
  const present = new Set(options.map((option) => option.id))
  return options.map((option) => {
    if (saved.some((old) => old.id === option.id)) return option
    const match = saved.find(
      (old) =>
        !present.has(old.id) && labelKey(old.label) === labelKey(option.label)
    )
    return match ? { ...option, id: match.id } : option
  })
}

export function choiceLabels(
  options: ChoiceOption[] | null,
  answer: ProjectAnswer
) {
  const selected = new Set(
    typeof answer === "string" ? [answer] : Array.isArray(answer) ? answer : []
  )
  return (options ?? [])
    .filter((option) => selected.has(option.id))
    .map((option) => option.label)
}

export function fileAnswer(answer: unknown): FileAnswer | null {
  const parsed = fileAnswerSchema.safeParse(answer)
  return parsed.success ? parsed.data : null
}

export function editableProjectAnswer(
  question: Pick<ProjectQuestion, "type" | "options">,
  stored: unknown
): ProjectAnswer {
  switch (question.type) {
    case "short_text":
    case "long_text":
    case "url":
      return typeof stored === "string" ? stored : ""
    case "single_choice":
      return typeof stored === "string" &&
        optionIds(question.options).has(stored)
        ? stored
        : ""
    case "multiple_choice": {
      const ids = optionIds(question.options)
      return Array.isArray(stored)
        ? stored.filter(
            (id): id is string => typeof id === "string" && ids.has(id)
          )
        : []
    }
    case "file":
      return fileAnswer(stored)
  }
}

export function normalizedProjectAnswer(answer: ProjectAnswer): ProjectAnswer {
  return typeof answer === "string" ? answer.trim() : answer
}
