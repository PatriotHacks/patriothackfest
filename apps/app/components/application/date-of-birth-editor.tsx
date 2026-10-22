"use client"

import { toZonedInputValue } from "@workspace/forms"
import { useState } from "react"

import { isValidDateOfBirth } from "@/lib/basic-info"
import { saveDateOfBirth } from "@/lib/basic-info-actions"

import { FormFieldError, FormInput, QuestionLabel } from "./form-controls"
import { SaveIndicator } from "./save-indicator"
import { useDraftAutosave } from "./use-draft-autosave"

const ID = "basic-date_of_birth"
const ERROR_ID = `${ID}-error`

export function DateOfBirthEditor({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const save = useDraftAutosave(saveDateOfBirth)
  const today = toZonedInputValue(new Date().toISOString()).slice(0, 10)

  function change(next: string) {
    setValue(next)
    if (isValidDateOfBirth(next)) {
      setError(null)
      save.schedule(next)
    } else {
      save.cancel()
      setError("Enter a valid date of birth")
    }
  }

  return (
    <div className="flex flex-col gap-[8px]">
      <QuestionLabel htmlFor={ID} required>
        Date of birth
      </QuestionLabel>
      <FormInput
        id={ID}
        type="date"
        autoComplete="bday"
        min="1900-01-01"
        max={today}
        value={value}
        onChange={(e) => change(e.target.value)}
        onBlur={() => void save.flush()}
        aria-invalid={error !== null}
        aria-describedby={error ? ERROR_ID : undefined}
      />
      {error ? (
        <FormFieldError id={ERROR_ID}>{error}</FormFieldError>
      ) : (
        <SaveIndicator status={save.status} error={save.error} />
      )}
    </div>
  )
}
