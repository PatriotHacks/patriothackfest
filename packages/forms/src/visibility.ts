import type { Answers, Field } from "./schema"

type FieldSet = { fields: readonly Field[] }

export function isFieldVisible(
  field: Field,
  answers: Answers,
  schema: FieldSet,
  seen: ReadonlySet<string> = new Set()
): boolean {
  const condition = field.condition
  if (!condition) return true
  if (seen.has(field.id)) return false

  const source = schema.fields.find((f) => f.id === condition.field_id)
  if (!source) return false
  if (!isFieldVisible(source, answers, schema, new Set([...seen, field.id])))
    return false

  const value = answers[source.id]
  if (condition.operator === "includes") {
    return Array.isArray(value) && value.includes(condition.value)
  }
  if (source.type === "checkbox") {
    return (value === true) === condition.value
  }
  return value === condition.value
}

export function pruneHiddenAnswers(schema: FieldSet, answers: Answers) {
  const pruned: Answers = {}
  for (const field of schema.fields) {
    if (field.id in answers && isFieldVisible(field, answers, schema)) {
      pruned[field.id] = answers[field.id]
    }
  }
  return pruned
}
