import { isChoiceType, type Field, type FieldType } from "@workspace/forms"

export function withType(field: Field, type: FieldType): Field {
  const shared = {
    id: field.id,
    label: field.label,
    help_text: field.help_text,
    validation: null,
  }
  if (type === "section") {
    return {
      ...shared,
      type,
      required: false,
      options: null,
      condition: null,
      editable_after_submit: false,
    }
  }
  const options = isChoiceType(type)
    ? isChoiceType(field.type)
      ? field.options
      : []
    : null
  return {
    ...shared,
    type,
    options,
    required: field.required,
    condition: field.condition,
  } as Field
}

export function updateField<F extends Field>(field: F, patch: Partial<F>): F {
  return { ...field, ...patch }
}
