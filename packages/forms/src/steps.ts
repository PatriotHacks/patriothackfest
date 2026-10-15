import { validateAnswers, type AnswerErrors } from "./answers"
import type { Answers, Field } from "./schema"
import type { SectionGroup } from "./sections"

type FieldSet = { fields: readonly Field[] }

export function sectionErrors(
  schema: FieldSet,
  answers: Answers,
  group: SectionGroup
): AnswerErrors {
  const errors = validateAnswers(schema, answers, { mode: "submit" })
  const section: AnswerErrors = {}
  for (const { id } of group.questions) {
    const error = errors[id]
    if (error) section[id] = error
  }
  return section
}

export function sectionsComplete(
  schema: FieldSet,
  answers: Answers,
  groups: readonly SectionGroup[]
) {
  const errors = validateAnswers(schema, answers, { mode: "submit" })
  return groups.map((group) => group.questions.every((q) => !errors[q.id]))
}

export function resolveStep(
  param: string | null,
  complete: readonly boolean[]
) {
  const firstIncomplete = complete.indexOf(false)
  const limit = firstIncomplete === -1 ? complete.length - 1 : firstIncomplete
  if (param === null || !/^-?\d+$/.test(param)) return limit
  return Math.min(Math.max(Number(param) - 1, 0), limit)
}
