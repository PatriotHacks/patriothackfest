"use client"

import { toZonedInputValue } from "@workspace/forms"

import type {
  BasicInfoDraft,
  BasicInfoErrors,
  BasicInfoKey,
} from "@/lib/basic-info"

import {
  FormFieldError,
  FormInput,
  FormSection,
  QuestionLabel,
  SectionHeading,
} from "./form-controls"
import { PhoneField } from "./phone-field"
import { SchoolCombobox } from "./school-combobox"

export const basicFieldId = (key: BasicInfoKey) => `basic-${key}`
const errorId = (key: BasicInfoKey) => `basic-${key}-error`

export function BasicInfoFields({
  value,
  errors,
  email,
  disabled,
  dateOfBirthDisabled,
  muted,
  onChange,
  onBlur,
}: {
  value: BasicInfoDraft
  errors: BasicInfoErrors
  email: string
  disabled: boolean
  dateOfBirthDisabled: boolean
  muted: boolean
  onChange: (next: BasicInfoDraft, key: BasicInfoKey) => void
  onBlur: () => void
}) {
  const today = toZonedInputValue(new Date().toISOString()).slice(0, 10)
  const a11y = (key: BasicInfoKey) => ({
    invalid: errors[key] !== undefined,
    describedBy: errors[key] ? errorId(key) : undefined,
  })

  function field(key: BasicInfoKey, label: string, control: React.ReactNode) {
    return (
      <div className="flex flex-col gap-[8px]">
        <QuestionLabel htmlFor={basicFieldId(key)} required>
          {label}
        </QuestionLabel>
        {control}
        {errors[key] && (
          <FormFieldError id={errorId(key)}>{errors[key]}</FormFieldError>
        )}
      </div>
    )
  }

  return (
    <FormSection muted={muted} aria-labelledby="basic-information">
      <SectionHeading id="basic-information" title="Basic Information" />
      {field(
        "full_name",
        "Full name",
        <FormInput
          id={basicFieldId("full_name")}
          autoComplete="name"
          maxLength={100}
          value={value.fullName}
          onChange={(e) =>
            onChange({ ...value, fullName: e.target.value }, "full_name")
          }
          onBlur={onBlur}
          disabled={disabled}
          aria-invalid={a11y("full_name").invalid}
          aria-describedby={a11y("full_name").describedBy}
        />
      )}
      <div className="flex flex-col gap-[8px]">
        <QuestionLabel htmlFor="basic-email">Email</QuestionLabel>
        <FormInput id="basic-email" value={email} readOnly disabled />
      </div>
      {field(
        "school",
        "School",
        <SchoolCombobox
          id={basicFieldId("school")}
          value={value.school}
          onChange={(school) => onChange({ ...value, school }, "school")}
          onBlur={onBlur}
          disabled={disabled}
          {...a11y("school")}
        />
      )}
      {field(
        "phone",
        "Phone number",
        <PhoneField
          id={basicFieldId("phone")}
          country={value.phoneCountry}
          national={value.phoneNational}
          onChange={(phoneCountry, phoneNational) =>
            onChange({ ...value, phoneCountry, phoneNational }, "phone")
          }
          onBlur={onBlur}
          disabled={disabled}
          {...a11y("phone")}
        />
      )}
      {field(
        "date_of_birth",
        "Date of birth",
        <FormInput
          id={basicFieldId("date_of_birth")}
          type="date"
          autoComplete="bday"
          min="1900-01-01"
          max={today}
          value={value.dateOfBirth}
          onChange={(e) =>
            onChange({ ...value, dateOfBirth: e.target.value }, "date_of_birth")
          }
          onBlur={onBlur}
          disabled={dateOfBirthDisabled}
          aria-invalid={a11y("date_of_birth").invalid}
          aria-describedby={a11y("date_of_birth").describedBy}
        />
      )}
    </FormSection>
  )
}
