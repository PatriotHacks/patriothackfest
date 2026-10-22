import { toZonedInputValue } from "@workspace/forms"
import * as z from "zod"

import { isValidE164, splitE164, toE164, type CountryCode } from "./phone"

export type BasicInfo = {
  fullName: string
  school: string
  phone: string | null
  dateOfBirth: string
}

export type BasicInfoDraft = {
  fullName: string
  school: string
  phoneCountry: CountryCode
  phoneNational: string
  dateOfBirth: string
}

export type Profile = {
  full_name: string | null
  school: string | null
  phone: string | null
  date_of_birth: string | null
}

export type BasicInfoKey = "full_name" | "school" | "phone" | "date_of_birth"
export type BasicInfoErrors = Partial<Record<BasicInfoKey, string>>

export const BASIC_INFO_KEYS: readonly BasicInfoKey[] = [
  "full_name",
  "school",
  "phone",
  "date_of_birth",
]

export const basicInfoSchema = z.object({
  fullName: z.string().max(400),
  school: z.string().max(400),
  phone: z.string().max(20).nullable(),
  dateOfBirth: z.string().max(10),
})

const isoDate = z.iso.date()

function todayInEventZone() {
  return toZonedInputValue(new Date().toISOString()).slice(0, 10)
}

export function isValidDateOfBirth(dob: string) {
  return (
    isoDate.safeParse(dob).success &&
    dob >= "1900-01-01" &&
    dob < todayInEventZone()
  )
}

export function basicInfoErrors(
  info: BasicInfo,
  mode: "draft" | "submit"
): BasicInfoErrors {
  const errors: BasicInfoErrors = {}
  const required = mode === "submit" ? "Required" : null

  const name = info.fullName.trim()
  if (name === "") errors.full_name = "Enter your name"
  else if ([...name].length > 100)
    errors.full_name = "Use 100 characters or fewer"

  const school = info.school.trim()
  if (school === "") {
    if (required) errors.school = required
  } else if ([...school].length > 200)
    errors.school = "Use 200 characters or fewer"

  if (info.phone === "") {
    if (required) errors.phone = required
  } else if (info.phone !== null && !isValidE164(info.phone))
    errors.phone = "Enter a valid phone number"

  const dob = info.dateOfBirth
  if (dob === "") {
    if (required) errors.date_of_birth = required
  } else if (!isValidDateOfBirth(dob))
    errors.date_of_birth = "Enter a valid date of birth"

  return errors
}

export function draftFromProfile(profile: Profile): BasicInfoDraft {
  const phone = splitE164(profile.phone)
  return {
    fullName: profile.full_name ?? "",
    school: profile.school ?? "",
    phoneCountry: phone.country,
    phoneNational: phone.national,
    dateOfBirth: profile.date_of_birth ?? "",
  }
}

export function toBasicInfo(draft: BasicInfoDraft): BasicInfo {
  return {
    fullName: draft.fullName,
    school: draft.school,
    phone:
      draft.phoneNational === ""
        ? ""
        : toE164(draft.phoneCountry, draft.phoneNational),
    dateOfBirth: draft.dateOfBirth,
  }
}

export function basicInfoDraftErrors(
  draft: BasicInfoDraft,
  mode: "draft" | "submit"
): BasicInfoErrors {
  const info = toBasicInfo(draft)
  const errors = basicInfoErrors(info, mode)
  if (info.phone === null) errors.phone = "Enter a valid phone number"
  return errors
}
