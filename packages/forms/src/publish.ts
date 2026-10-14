import {
  isChoiceType,
  isConditionSourceType,
  isSection,
  type Field,
} from "./schema"

export type PublishIssue = { field_id: string | null; message: string }

export type PublishableForm = {
  title: string
  submissions_close_at: string | null
  edits_lock_at: string | null
}

export function conditionOperatorFor(source: Field) {
  return source.type === "multiple_choice" ? "includes" : "equals"
}

export function conditionSources(fields: readonly Field[], index: number) {
  const sources: Field[] = []
  for (let i = index - 1; i >= 0 && !isSection(fields[i]!); i--) {
    if (isConditionSourceType(fields[i]!.type)) sources.unshift(fields[i]!)
  }
  return sources
}

function hasValidOptions(options: string[]) {
  return (
    options.every((o) => o.trim() !== "") &&
    new Set(options).size === options.length
  )
}

function isValidConditionValue(source: Field, field: Field) {
  const condition = field.condition!
  if (condition.operator !== conditionOperatorFor(source)) return false
  if (source.type === "checkbox") return typeof condition.value === "boolean"
  return (
    typeof condition.value === "string" &&
    (source.options ?? []).includes(condition.value)
  )
}

export function validateForPublish(
  form: PublishableForm,
  fields: readonly Field[]
) {
  const issues: PublishIssue[] = []
  const add = (message: string, field_id: string | null = null) =>
    issues.push({ field_id, message })

  if (form.title.trim() === "") add("Add a form title")

  if (!form.submissions_close_at || !form.edits_lock_at) {
    add("Set both deadlines before publishing")
  } else if (
    new Date(form.edits_lock_at) < new Date(form.submissions_close_at)
  ) {
    add("Edits lock must be at or after submissions close")
  }

  let sections = 0
  let questions = 0
  fields.forEach((field, index) => {
    if (isSection(field)) {
      sections += 1
      if (field.label.trim() === "")
        add(`Section ${sections} needs a title`, field.id)
      return
    }

    questions += 1
    const n = questions
    if (field.label.trim() === "") add(`Question ${n} needs a label`, field.id)

    if (isChoiceType(field.type)) {
      const options = field.options ?? []
      if (options.length === 0) {
        add(`Question ${n} needs at least one option`, field.id)
      } else if (!hasValidOptions(options)) {
        add(`Question ${n} has blank or duplicate options`, field.id)
      }
    }

    if (field.condition) {
      const sourceId = field.condition.field_id
      const source = fields
        .slice(0, index)
        .find((f) => f.id === sourceId && isConditionSourceType(f.type))
      if (!source) {
        add(
          `Question ${n} must depend on an earlier choice or checkbox question`,
          field.id
        )
      } else if (!conditionSources(fields, index).includes(source)) {
        add(
          `Question ${n} must depend on a question in the same section`,
          field.id
        )
      } else if (!isValidConditionValue(source, field)) {
        add(`Question ${n} has an invalid condition`, field.id)
      }
    }
  })

  if (fields.length > 0 && !isSection(fields[0]!))
    add("Start the form with a section")
  if (questions === 0) add("Add at least one question")

  return issues
}
