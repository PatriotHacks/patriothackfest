import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js"

export type { CountryCode }

export const DEFAULT_COUNTRY: CountryCode = "US"

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })

export const PHONE_COUNTRIES = getCountries()
  .map((code) => ({
    code,
    label: `${regionNames.of(code)!} (+${getCountryCallingCode(code)})`,
  }))
  .sort((a, b) => a.label.localeCompare(b.label))

const E164 = /^\+[1-9]\d{6,14}$/

export function isValidE164(phone: string) {
  return E164.test(phone) && isValidPhoneNumber(phone)
}

export function toE164(country: CountryCode, national: string) {
  const parsed = parsePhoneNumberFromString(national, country)
  return parsed?.isValid() ? parsed.number : null
}

export function splitE164(phone: string | null) {
  const parsed = phone ? parsePhoneNumberFromString(phone) : undefined
  return {
    country: parsed?.country ?? DEFAULT_COUNTRY,
    national: parsed?.nationalNumber ?? "",
  }
}
