"use server"

import { revalidatePath } from "next/cache"
import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import { eventJudgeInput } from "@/lib/judges"

export async function saveEventJudge(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = eventJudgeInput.safeParse(input)
  if (!parsed.success)
    return failure({
      message: parsed.error.issues[0]?.message ?? "Invalid judge settings",
    })
  const value = parsed.data
  const { error } = await supabase.rpc("admin_save_event_judge", {
    p_event_id: value.eventId,
    p_judge_id: value.judgeId,
    p_email: value.email,
    p_kind: value.kind,
    p_active: value.active,
    p_capacity: value.capacity,
    p_track_ids: value.trackIds,
  })
  if (error) return failure(error)
  revalidatePath("/judging")
  return ok
}
