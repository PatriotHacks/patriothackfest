"use server"

import * as z from "zod"

import { failure, ok, type ActionResult } from "./action-result"
import { getApplicant } from "./applicant"
import {
  basicInfoErrors,
  basicInfoSchema,
  isValidDateOfBirth,
  type BasicInfo,
} from "./basic-info"

export async function saveBasicInfo(input: BasicInfo): Promise<ActionResult> {
  const info = basicInfoSchema.parse(input)
  const problem = Object.values(basicInfoErrors(info, "draft"))[0]
  if (problem) return { error: problem }
  const { supabase } = await getApplicant()

  const { error } = await supabase.rpc("update_basic_info", {
    p_full_name: info.fullName.trim(),
    p_school: info.school.trim() || undefined,
    p_phone: info.phone || undefined,
    p_keep_phone: info.phone === null,
    p_date_of_birth: info.dateOfBirth || undefined,
  })
  if (error) return failure(error)
  return ok
}

export async function saveDateOfBirth(
  dateOfBirth: string
): Promise<ActionResult> {
  const dob = z.string().max(10).parse(dateOfBirth)
  if (!isValidDateOfBirth(dob)) return { error: "Enter a valid date of birth" }
  const { supabase, userId } = await getApplicant()

  const profile = await supabase
    .from("profiles")
    .select("full_name, school")
    .eq("id", userId)
    .single()
  if (profile.error) return failure(profile.error)

  const { error } = await supabase.rpc("update_basic_info", {
    p_full_name: profile.data.full_name ?? "",
    p_school: profile.data.school ?? undefined,
    p_keep_phone: true,
    p_date_of_birth: dob,
  })
  if (error) return failure(error)
  return ok
}
