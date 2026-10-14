"use client"

import type { Question } from "@workspace/forms"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"

import { fieldErrorId, fieldInputId, fieldLabelId } from "./field-ids"
import { FormInput, FormTextarea, OLIVE_CHECK, TILE } from "./form-controls"
import { NumberInput } from "./number-input"

export function FieldInput({
  field,
  value,
  invalid,
  disabled,
  onChange,
  onBlur,
}: {
  field: Exclude<Question, { type: "file" }>
  value: unknown
  invalid: boolean
  disabled: boolean
  onChange: (value: unknown) => void
  onBlur: () => void
}) {
  const inputId = fieldInputId(field.id)
  const a11y = {
    "aria-invalid": invalid,
    "aria-describedby": invalid ? fieldErrorId(field.id) : undefined,
  }
  const text = typeof value === "string" ? value : ""

  switch (field.type) {
    case "short_text":
    case "email":
    case "url":
    case "date":
      return (
        <FormInput
          id={inputId}
          type={
            field.type === "short_text"
              ? "text"
              : field.type === "email"
                ? "email"
                : field.type
          }
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          {...a11y}
        />
      )
    case "long_text":
      return (
        <FormTextarea
          id={inputId}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          {...a11y}
        />
      )
    case "number":
      return (
        <NumberInput
          id={inputId}
          value={value}
          onValueChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          {...a11y}
        />
      )
    case "single_choice":
      return (
        <RadioGroup
          id={inputId}
          aria-labelledby={fieldLabelId(field.id)}
          value={text}
          onValueChange={(next) => {
            onChange(next)
            onBlur()
          }}
          disabled={disabled}
          {...a11y}
        >
          {field.options.map((option, i) => (
            <label key={option} htmlFor={`${inputId}-${i}`} className={TILE}>
              <RadioGroupItem
                value={option}
                id={`${inputId}-${i}`}
                className={OLIVE_CHECK}
              />
              {option}
            </label>
          ))}
        </RadioGroup>
      )
    case "multiple_choice": {
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <div
          id={inputId}
          role="group"
          aria-labelledby={fieldLabelId(field.id)}
          className="flex flex-col gap-2"
          {...a11y}
        >
          {field.options.map((option, i) => (
            <label key={option} htmlFor={`${inputId}-${i}`} className={TILE}>
              <Checkbox
                id={`${inputId}-${i}`}
                className={OLIVE_CHECK}
                checked={selected.includes(option)}
                onCheckedChange={(checked) => {
                  onChange(
                    checked
                      ? field.options.filter(
                          (o) => o === option || selected.includes(o)
                        )
                      : selected.filter((s) => s !== option)
                  )
                  onBlur()
                }}
                disabled={disabled}
              />
              {option}
            </label>
          ))}
        </div>
      )
    }
    case "checkbox":
      return (
        <label htmlFor={inputId} className={TILE}>
          <Checkbox
            id={inputId}
            className={OLIVE_CHECK}
            checked={value === true}
            onCheckedChange={(checked) => {
              onChange(checked === true)
              onBlur()
            }}
            disabled={disabled}
            {...a11y}
          />
          Yes
        </label>
      )
  }
}
