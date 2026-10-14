import type { AnswerErrors } from "./answers"
import type { Answers, Field } from "./schema"

export const LOCKED_ANSWER_ERROR = "This answer can no longer be changed"

export function lockedFieldIds(schema: { fields: readonly Field[] }) {
  const locked = new Set<string>()
  let editable = false
  for (const field of schema.fields) {
    if (field.type === "section") editable = field.editable_after_submit
    else if (!editable) locked.add(field.id)
  }
  return locked
}

export function hasEditableSections(schema: { fields: readonly Field[] }) {
  return schema.fields.some(
    (f) => f.type === "section" && f.editable_after_submit
  )
}

function sameAnswer(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  return (
    aKeys.length === bKeys.length &&
    aKeys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameAnswer(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
    )
  )
}

export function lockedAnswerErrors(
  schema: { fields: readonly Field[] },
  before: Answers,
  after: Answers
) {
  const errors: AnswerErrors = {}
  for (const id of lockedFieldIds(schema)) {
    if (!sameAnswer(before[id], after[id])) errors[id] = LOCKED_ANSWER_ERROR
  }
  return errors
}
