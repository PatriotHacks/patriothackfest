import { toZonedInputValue } from "@workspace/forms"
import * as z from "zod"

import { isValidE164 } from "./phone"

export type BasicInfo = {
  fullName: string
  school: string
  phone: string
  dateOfBirth: string
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
  phone: z.string().max(20),
  dateOfBirth: z.string().max(10),
})

const isoDate = z.iso.date()

function todayInEventZone() {
  return toZonedInputValue(new Date().toISOString()).slice(0, 10)
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
  } else if (!isValidE164(info.phone))
    errors.phone = "Enter a valid phone number"

  const dob = info.dateOfBirth
  if (dob === "") {
    if (required) errors.date_of_birth = required
  } else if (
    !isoDate.safeParse(dob).success ||
    dob < "1900-01-01" ||
    dob >= todayInEventZone()
  )
    errors.date_of_birth = "Enter a valid date of birth"

  return errors
}
