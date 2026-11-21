"use server"

import { revalidatePath } from "next/cache"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import {
  deleteJudgingCriterionInput,
  judgingCriterionInput,
  reorderJudgingCriteriaInput,
} from "@/lib/judging-criteria"

export async function saveJudgingCriterion(
  input: unknown
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = judgingCriterionInput.safeParse(input)
  if (!parsed.success)
    return failure({
      message: parsed.error.issues[0]?.message ?? "Invalid criterion",
    })
  const value = parsed.data
  const { error } = await supabase.rpc("admin_save_judging_criterion", {
    p_event_id: value.eventId,
    p_criterion_id: value.criterionId,
    p_name: value.name,
    p_description: value.description,
  })
  if (error) return failure(error)
  revalidatePath("/judging")
  return ok
}

export async function deleteJudgingCriterion(
  input: unknown
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = deleteJudgingCriterionInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid criterion" })
  const { error } = await supabase.rpc("admin_delete_judging_criterion", {
    p_event_id: parsed.data.eventId,
    p_criterion_id: parsed.data.criterionId,
  })
  if (error) return failure(error)
  revalidatePath("/judging")
  return ok
}

export async function reorderJudgingCriteria(
  input: unknown
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = reorderJudgingCriteriaInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid criteria order" })
  const { error } = await supabase.rpc("admin_reorder_judging_criteria", {
    p_event_id: parsed.data.eventId,
    p_criterion_ids: parsed.data.criterionIds,
  })
  if (error) return failure(error)
  revalidatePath("/judging")
  return ok
}
