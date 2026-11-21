"use server"

import { revalidatePath } from "next/cache"
import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import {
  eventJudgeInput,
  eventJudgeRefInput,
  judgeGuestInput,
  judgeTransferPreviewSchema,
  judgeTransferSchema,
  savedJudgeSchema,
  type JudgeTransfer,
  type JudgeTransferPreview,
} from "@/lib/judges"

export async function saveEventJudge(
  input: unknown
): Promise<ActionResult & { transfer?: JudgeTransfer | null }> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = eventJudgeInput.safeParse(input)
  if (!parsed.success)
    return failure({
      message: parsed.error.issues[0]?.message ?? "Invalid judge settings",
    })
  const value = parsed.data
  const { data, error } = await supabase.rpc("admin_save_event_judge", {
    p_event_id: value.eventId,
    p_judge_id: value.judgeId,
    p_email: value.email,
    p_kind: value.kind,
    p_active: value.active,
    p_capacity: value.capacity,
    p_track_ids: value.trackIds,
  })
  if (error) return failure(error)
  const { transfer } = savedJudgeSchema.parse(data)
  revalidatePath("/judging")
  return { error: null, transfer }
}

export async function setEventJudgeGuest(
  input: unknown
): Promise<ActionResult & { transfer?: JudgeTransfer }> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = judgeGuestInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid judge" })
  const { data, error } = await supabase.rpc("admin_set_event_judge_guest", {
    p_event_id: parsed.data.eventId,
    p_judge_id: parsed.data.judgeId,
    p_guest: parsed.data.guest,
  })
  if (error) return failure(error)
  const transfer = judgeTransferSchema.parse(data)
  revalidatePath("/judging")
  return { error: null, transfer }
}

export async function previewJudgeTransfer(
  input: unknown
): Promise<ActionResult & { preview?: JudgeTransferPreview }> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = eventJudgeRefInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid judge" })
  const { data, error } = await supabase.rpc("admin_judge_transfer_preview", {
    p_event_id: parsed.data.eventId,
    p_judge_id: parsed.data.judgeId,
  })
  if (error) return failure(error)
  return { error: null, preview: judgeTransferPreviewSchema.parse(data) }
}

export async function deleteEventJudge(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = eventJudgeRefInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid judge" })
  const { error } = await supabase.rpc("admin_delete_event_judge", {
    p_event_id: parsed.data.eventId,
    p_judge_id: parsed.data.judgeId,
  })
  if (error) return failure(error)
  revalidatePath("/judging")
  return ok
}
