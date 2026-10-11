import type { Field } from "./schema"

let counter = 0

export function fieldId() {
  counter += 1
  return `00000000-0000-4000-8000-${counter.toString().padStart(12, "0")}`
}

export function field<T extends Field["type"]>(
  type: T,
  overrides: Partial<Extract<Field, { type: T }>> = {}
): Extract<Field, { type: T }> {
  return {
    id: fieldId(),
    type,
    label: type,
    help_text: null,
    required: false,
    options:
      type === "single_choice" || type === "multiple_choice"
        ? ["A", "B"]
        : null,
    validation: null,
    condition: null,
    ...overrides,
  } as Extract<Field, { type: T }>
}
