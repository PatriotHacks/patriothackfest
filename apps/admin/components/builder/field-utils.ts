import { isChoiceType, type Field, type FieldType } from "@workspace/forms"

export function withType(field: Field, type: FieldType): Field {
  const options = isChoiceType(type)
    ? isChoiceType(field.type)
      ? field.options
      : []
    : null
  return { ...field, type, options, validation: null } as Field
}

export function updateField<F extends Field>(field: F, patch: Partial<F>): F {
  return { ...field, ...patch }
}
