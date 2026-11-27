"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import {
  awardInput,
  awardProjectInput,
  type AwardInput,
  type AwardProjectInput,
} from "@/lib/awards"

export async function saveAward(input: AwardInput): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = awardInput.safeParse(input)
  if (!parsed.success)
    return failure({
      message: parsed.error.issues[0]?.message ?? "Invalid award",
    })
  const value = parsed.data
  const { error } = await supabase.rpc("admin_save_award", {
    p_event_id: value.eventId,
    p_award_id: value.awardId,
    p_name: value.name,
    p_rank: value.rank,
    p_track_id: value.trackId ?? undefined,
  })
  if (error) return failure(error)
  revalidatePath("/awards")
  return ok
}

export async function deleteAward(
  eventId: string,
  awardId: string
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const input = z
    .object({ eventId: z.guid(), awardId: z.guid() })
    .safeParse({ eventId, awardId })
  if (!input.success) return failure({ message: "Invalid award" })
  const { error } = await supabase.rpc("admin_delete_award", {
    p_event_id: input.data.eventId,
    p_award_id: input.data.awardId,
  })
  if (error) return failure(error)
  revalidatePath("/awards")
  return ok
}

export async function assignAward(
  input: AwardProjectInput
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = awardProjectInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid award winner" })
  const { error } = await supabase.rpc("admin_assign_award", {
    p_event_id: parsed.data.eventId,
    p_award_id: parsed.data.awardId,
    p_project_id: parsed.data.projectId,
  })
  if (error) return failure(error)
  revalidatePath("/awards")
  return ok
}

export async function unassignAward(
  input: AwardProjectInput
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = awardProjectInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid award winner" })
  const { error } = await supabase.rpc("admin_unassign_award", {
    p_event_id: parsed.data.eventId,
    p_award_id: parsed.data.awardId,
    p_project_id: parsed.data.projectId,
  })
  if (error) return failure(error)
  revalidatePath("/awards")
  return ok
}
