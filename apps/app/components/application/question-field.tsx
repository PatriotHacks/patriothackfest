"use client"

import { textLimit, type Question } from "@workspace/forms"

import {
  fieldContainerId,
  fieldCountId,
  fieldErrorId,
  fieldInputId,
  fieldLabelId,
} from "./field-ids"
import { FieldInput } from "./field-input"
import { FileField } from "./file-field"
import {
  FormFieldError,
  FormHelp,
  QuestionLabel,
  TextLengthCounter,
} from "./form-controls"

export function QuestionField({
  field,
  value,
  error,
  disabled,
  userId,
  applicationId,
  onChange,
  onBlur,
  onUploadingChange,
}: {
  field: Question
  value: unknown
  error: string | undefined
  disabled: boolean
  userId: string
  applicationId: string
  onChange: (value: unknown) => void
  onBlur: () => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const limit = textLimit(field)
  return (
    <div id={fieldContainerId(field.id)} className="flex flex-col gap-[8px]">
      <QuestionLabel
        id={fieldLabelId(field.id)}
        htmlFor={fieldInputId(field.id)}
        required={field.required}
      >
        {field.label}
      </QuestionLabel>
      {field.help_text && <FormHelp>{field.help_text}</FormHelp>}
      {field.type === "file" ? (
        <FileField
          field={field}
          value={value}
          invalid={error !== undefined}
          disabled={disabled}
          userId={userId}
          applicationId={applicationId}
          onChange={onChange}
          onUploadingChange={onUploadingChange}
        />
      ) : (
        <FieldInput
          field={field}
          value={value}
          invalid={error !== undefined}
          disabled={disabled}
          onChange={onChange}
          onBlur={onBlur}
        />
      )}
      {limit && (
        <TextLengthCounter
          id={fieldCountId(field.id)}
          text={typeof value === "string" ? value : ""}
          limit={limit.max}
          unit={limit.unit}
        />
      )}
      {error && (
        <FormFieldError id={fieldErrorId(field.id)}>{error}</FormFieldError>
      )}
    </div>
  )
}
