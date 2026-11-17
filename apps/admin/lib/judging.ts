import {
  fromZonedInputValue,
  isProjectChoiceType,
  isProjectTextType,
  MAX_FILE_SIZE_MB,
  MAX_PROJECT_ANSWER_LENGTH,
  projectQuestionSchema,
  projectQuestionTypeSchema,
  toZonedInputValue,
} from "@workspace/forms"
import type { Tables } from "@workspace/supabase/types"
import * as z from "zod"

const localDateTime = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false
  try {
    return toZonedInputValue(fromZonedInputValue(value)) === value
  } catch {
    return false
  }
}, "Enter a valid Eastern date and time")

export const competitionSettingsInput = z.object({
  eventId: z.guid(),
  enabled: z.boolean(),
  open: z.union([z.literal(""), localDateTime]),
  close: z.union([z.literal(""), localDateTime]),
  judgingEnd: z.union([z.literal(""), localDateTime]),
  generalReviews: z.number().int().min(1).max(20),
})

export type CompetitionSettingsInput = z.infer<typeof competitionSettingsInput>

export const submissionSettingsInput = competitionSettingsInput.pick({
  eventId: true,
  enabled: true,
  open: true,
  close: true,
})
export const judgingSettingsInput = competitionSettingsInput.pick({
  eventId: true,
  judgingEnd: true,
  generalReviews: true,
})
export type SubmissionSettingsInput = z.infer<typeof submissionSettingsInput>
export type JudgingSettingsInput = z.infer<typeof judgingSettingsInput>

// Saved settings as form values, so each half can be saved with the other's stored values.
export function competitionSettingsValues(
  eventId: string,
  settings: Tables<"event_competition_settings"> | null
): CompetitionSettingsInput {
  return {
    eventId,
    enabled: settings?.enabled ?? false,
    open: settings?.project_submissions_open_at
      ? toZonedInputValue(settings.project_submissions_open_at)
      : "",
    close: settings?.project_submissions_close_at
      ? toZonedInputValue(settings.project_submissions_close_at)
      : "",
    judgingEnd: judgingEndInputValue(settings?.judging_close_at ?? null),
    generalReviews: settings?.general_reviews_per_project ?? 3,
  }
}

export function competitionDates(input: CompetitionSettingsInput) {
  const open = input.open ? fromZonedInputValue(input.open) : null
  const close = input.close ? fromZonedInputValue(input.close) : null
  // The UI selects the final included minute, while SQL uses an exclusive cutoff.
  const judgingClose = input.judgingEnd
    ? new Date(
        Date.parse(fromZonedInputValue(input.judgingEnd)) + 60_000
      ).toISOString()
    : null

  if (input.enabled && (!open || !judgingClose)) {
    throw new Error("Set submission opening and judging end before enabling")
  }
  if (close && (!open || Date.parse(close) <= Date.parse(open))) {
    throw new Error("Submission closing must be after opening")
  }
  const lastSubmissionDate = close ?? open
  if (
    judgingClose &&
    lastSubmissionDate &&
    Date.parse(judgingClose) <= Date.parse(lastSubmissionDate)
  ) {
    throw new Error("Judging end must be after the submission dates")
  }
  return { open, close, judgingClose }
}

export function judgingEndInputValue(cutoff: string | null) {
  return cutoff
    ? toZonedInputValue(new Date(Date.parse(cutoff) - 60_000).toISOString())
    : ""
}

export const competitionTrackInput = z.object({
  eventId: z.guid(),
  trackId: z.guid().optional(),
  name: z.string().trim().min(1).max(120),
  sponsor: z.string().trim().max(120),
  description: z.string().trim().max(2000),
  reviews: z.number().int().min(1).max(20),
  active: z.boolean(),
})

export type CompetitionTrackInput = z.infer<typeof competitionTrackInput>

export const projectQuestionInput = z
  .object({
    eventId: z.guid(),
    questionId: z.guid().optional(),
    label: z.string().trim().min(1, "Enter a question").max(300),
    helpText: z.string().trim().max(1000),
    required: z.boolean(),
    type: projectQuestionTypeSchema,
    maxLength: z.number().int().min(1).max(MAX_PROJECT_ANSWER_LENGTH),
    options: z
      .array(
        z.object({
          id: z.guid(),
          label: z
            .string()
            .trim()
            .min(1, "Enter a label for every option")
            .max(200, "Use 200 characters or fewer per option"),
        })
      )
      .max(50, "Use 50 options or fewer"),
    maxSizeMb: z
      .number()
      .positive()
      .max(
        MAX_FILE_SIZE_MB,
        `Maximum file size must be at most ${MAX_FILE_SIZE_MB} MB`
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (!isProjectChoiceType(value.type)) return
    if (value.options.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Add at least one option",
      })
    const labels = value.options.map((option) => option.label.toLowerCase())
    if (new Set(labels).size !== labels.length)
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Option labels must be unique",
      })
  })

export function projectQuestionRpcArgs(value: ProjectQuestionInput) {
  return {
    p_event_id: value.eventId,
    p_question_id: value.questionId,
    p_label: value.label,
    p_help_text: value.helpText,
    p_required: value.required,
    p_type: value.type,
    p_max_length: isProjectTextType(value.type) ? value.maxLength : undefined,
    p_options: isProjectChoiceType(value.type) ? value.options : undefined,
    p_validation:
      value.type === "file" && value.maxSizeMb !== undefined
        ? { max_size_mb: value.maxSizeMb }
        : undefined,
  }
}

export type ProjectQuestionInput = z.infer<typeof projectQuestionInput>

export const adminProjectQuestionsSchema = z.array(
  projectQuestionSchema.extend({ answered: z.boolean() })
)

export type AdminProjectQuestion = z.infer<
  typeof adminProjectQuestionsSchema
>[number]
