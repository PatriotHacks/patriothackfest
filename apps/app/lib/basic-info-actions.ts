"use server"

import { failure, ok, type ActionResult } from "./action-result"
import { getApplicant } from "./applicant"
import { basicInfoErrors, basicInfoSchema, type BasicInfo } from "./basic-info"

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
