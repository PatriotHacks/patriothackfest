import * as z from "zod"

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "url",
  "number",
  "date",
  "single_choice",
  "multiple_choice",
  "checkbox",
  "file",
] as const

export const fieldTypeSchema = z.enum(FIELD_TYPES)
export type FieldType = z.infer<typeof fieldTypeSchema>

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  url: "URL",
  number: "Number",
  date: "Date",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  checkbox: "Checkbox",
  file: "File upload",
}

export const CHOICE_TYPES = ["single_choice", "multiple_choice"] as const
export const CONDITION_SOURCE_TYPES = [
  "single_choice",
  "multiple_choice",
  "checkbox",
] as const

export function isChoiceType(type: FieldType) {
  return (CHOICE_TYPES as readonly FieldType[]).includes(type)
}

export function isConditionSourceType(type: FieldType) {
  return (CONDITION_SOURCE_TYPES as readonly FieldType[]).includes(type)
}

export const DEFAULT_FILE_ACCEPT = ["application/pdf"]
export const DEFAULT_FILE_MAX_SIZE_MB = 10
export const MAX_FILE_SIZE_MB = 10

export const textValidationSchema = z.object({
  min_length: z.int().nonnegative().optional(),
  max_length: z.int().positive().optional(),
})

export const numberValidationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional(),
})

export const dateValidationSchema = z.object({
  min: z.iso.date().optional(),
  max: z.iso.date().optional(),
})

export const fileValidationSchema = z.object({
  accept: z
    .array(
      z.string().refine((type) => DEFAULT_FILE_ACCEPT.includes(type), {
        message: "Only PDF uploads are supported",
      })
    )
    .min(1)
    .optional(),
  max_size_mb: z.number().positive().max(MAX_FILE_SIZE_MB).optional(),
})

export type TextValidation = z.infer<typeof textValidationSchema>
export type NumberValidation = z.infer<typeof numberValidationSchema>
export type DateValidation = z.infer<typeof dateValidationSchema>
export type FileValidation = z.infer<typeof fileValidationSchema>

export const conditionSchema = z.object({
  field_id: z.guid(),
  operator: z.enum(["equals", "includes"]),
  value: z.union([z.string(), z.boolean()]),
})

export type Condition = z.infer<typeof conditionSchema>
export type ConditionOperator = Condition["operator"]

const base = {
  id: z.guid(),
  label: z.string(),
  help_text: z.string().nullable(),
  required: z.boolean(),
  condition: conditionSchema.nullable(),
}

const noOptions = { options: z.null() }
const noValidation = { validation: z.null() }

export const fieldSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    ...noOptions,
    type: z.literal("short_text"),
    validation: textValidationSchema.nullable(),
  }),
  z.object({
    ...base,
    ...noOptions,
    type: z.literal("long_text"),
    validation: textValidationSchema.nullable(),
  }),
  z.object({
    ...base,
    ...noOptions,
    ...noValidation,
    type: z.literal("email"),
  }),
  z.object({ ...base, ...noOptions, ...noValidation, type: z.literal("url") }),
  z.object({
    ...base,
    ...noOptions,
    type: z.literal("number"),
    validation: numberValidationSchema.nullable(),
  }),
  z.object({
    ...base,
    ...noOptions,
    type: z.literal("date"),
    validation: dateValidationSchema.nullable(),
  }),
  z.object({
    ...base,
    ...noValidation,
    type: z.literal("single_choice"),
    options: z.array(z.string()),
  }),
  z.object({
    ...base,
    ...noValidation,
    type: z.literal("multiple_choice"),
    options: z.array(z.string()),
  }),
  z.object({
    ...base,
    ...noOptions,
    ...noValidation,
    type: z.literal("checkbox"),
  }),
  z.object({
    ...base,
    ...noOptions,
    type: z.literal("file"),
    validation: fileValidationSchema.nullable(),
  }),
])

export type Field = z.infer<typeof fieldSchema>

export const publishedSchemaSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  fields: z.array(fieldSchema),
})

export type PublishedSchema = z.infer<typeof publishedSchemaSchema>

export const fileAnswerSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  type: z.string(),
})

export type FileAnswer = z.infer<typeof fileAnswerSchema>
export type AnswerValue = string | number | boolean | string[] | FileAnswer
export type Answers = Record<string, unknown>

export function emptyFieldContent(type: FieldType) {
  return {
    options: isChoiceType(type) ? [] : null,
    validation: null,
  }
}
