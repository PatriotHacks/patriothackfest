"use client"

import { PHONE_COUNTRIES, type CountryCode } from "@/lib/phone"

import { FormInput, FormSelect } from "./form-controls"

export function PhoneField({
  id,
  country,
  national,
  onChange,
  onBlur,
  invalid,
  describedBy,
  disabled,
}: {
  id: string
  country: CountryCode
  national: string
  onChange: (country: CountryCode, national: string) => void
  onBlur: () => void
  invalid: boolean
  describedBy: string | undefined
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-[8px] sm:flex-row">
      <FormSelect
        aria-label="Country calling code"
        className="sm:w-[220px]"
        value={country}
        onChange={(e) => {
          onChange(e.target.value as CountryCode, national)
          onBlur()
        }}
        disabled={disabled}
      >
        {PHONE_COUNTRIES.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </FormSelect>
      <FormInput
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={15}
        placeholder="7035551234"
        className="flex-1"
        value={national}
        onChange={(e) => onChange(country, e.target.value.replace(/\D/g, ""))}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
    </div>
  )
}
