import * as z from "zod"

import {
  DEFAULT_FILE_ACCEPT,
  DEFAULT_FILE_MAX_SIZE_MB,
  fileAnswerSchema,
  type Answers,
  type Field,
} from "./schema"
import { isFieldVisible } from "./visibility"

export type ValidationMode = "draft" | "submit"
export type AnswerErrors = Record<string, string>

const emailSchema = z.email()
const urlSchema = z.url({ protocol: /^https?$/ })
const dateSchema = z.iso.date()

export function isEmptyAnswer(field: Field, value: unknown) {
  if (value === undefined || value === null) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  if (field.type === "checkbox") return value === false
  return false
}

function validateValue(field: Field, value: unknown): string | null {
  switch (field.type) {
    case "short_text":
    case "long_text": {
      if (typeof value !== "string") return "Enter text"
      const { min_length, max_length } = field.validation ?? {}
      const length = [...value.trim()].length
      if (min_length !== undefined && length < min_length)
        return `Enter at least ${min_length} characters`
      if (max_length !== undefined && length > max_length)
        return `Enter at most ${max_length} characters`
      return null
    }
    case "email":
      return emailSchema.safeParse(value).success
        ? null
        : "Enter a valid email address"
    case "url":
      return urlSchema.safeParse(value).success
        ? null
        : "Enter a valid URL starting with http:// or https://"
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value))
        return "Enter a number"
      const { min, max, integer } = field.validation ?? {}
      if (integer && !Number.isInteger(value)) return "Enter a whole number"
      if (min !== undefined && value < min) return `Enter ${min} or more`
      if (max !== undefined && value > max) return `Enter ${max} or less`
      return null
    }
    case "date": {
      if (!dateSchema.safeParse(value).success) return "Enter a valid date"
      const date = value as string
      const { min, max } = field.validation ?? {}
      if (min !== undefined && date < min) return `Enter ${min} or later`
      if (max !== undefined && date > max) return `Enter ${max} or earlier`
      return null
    }
    case "single_choice":
      return typeof value === "string" && field.options.includes(value)
        ? null
        : "Choose one of the options"
    case "multiple_choice":
      return Array.isArray(value) &&
        value.every(
          (v) => typeof v === "string" && field.options.includes(v)
        ) &&
        new Set(value).size === value.length
        ? null
        : "Choose from the options"
    case "checkbox":
      return typeof value === "boolean" ? null : "Invalid value"
    case "file": {
      const parsed = fileAnswerSchema.safeParse(value)
      if (!parsed.success) return "Upload a file"
      const accept = field.validation?.accept ?? DEFAULT_FILE_ACCEPT
      const maxSizeMb =
        field.validation?.max_size_mb ?? DEFAULT_FILE_MAX_SIZE_MB
      if (!accept.includes(parsed.data.type))
        return "This file type is not allowed"
      if (parsed.data.size > maxSizeMb * 1024 * 1024)
        return `Files must be ${maxSizeMb} MB or smaller`
      return null
    }
  }
}

export function validateAnswers(
  schema: { fields: readonly Field[] },
  answers: Answers,
  { mode }: { mode: ValidationMode }
) {
  const errors: AnswerErrors = {}
  for (const field of schema.fields) {
    if (!isFieldVisible(field, answers, schema)) continue
    const value = answers[field.id]
    if (isEmptyAnswer(field, value)) {
      if (mode === "submit" && field.required) errors[field.id] = "Required"
      continue
    }
    const error = validateValue(field, value)
    if (error) errors[field.id] = error
  }
  return errors
}
