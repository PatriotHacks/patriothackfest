"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import {
  competitionDates,
  competitionSettingsInput,
  competitionTrackInput,
  type CompetitionSettingsInput,
  type CompetitionTrackInput,
} from "@/lib/judging"

export async function saveCompetitionSettings(
  input: CompetitionSettingsInput
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = competitionSettingsInput.safeParse(input)
  if (!parsed.success)
    return failure({
      message: parsed.error.issues[0]?.message ?? "Invalid settings",
    })
  let dates: ReturnType<typeof competitionDates>
  try {
    dates = competitionDates(parsed.data)
  } catch (error) {
    return failure({
      message: error instanceof Error ? error.message : "Invalid dates",
    })
  }
  const { error } = await supabase.rpc("admin_save_competition_settings", {
    p_event_id: parsed.data.eventId,
    p_enabled: parsed.data.enabled,
    p_open_at: dates.open ?? undefined,
    p_close_at: dates.close ?? undefined,
    p_judging_close_at: dates.judgingClose ?? undefined,
    p_general_reviews: parsed.data.generalReviews,
  })
  if (error) return failure(error)
  revalidatePath("/judging")
  return ok
}

export async function saveCompetitionTrack(
  input: CompetitionTrackInput
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = competitionTrackInput.safeParse(input)
  if (!parsed.success)
    return failure({
      message: parsed.error.issues[0]?.message ?? "Invalid track",
    })
  const value = parsed.data
  const { error } = await supabase.rpc("admin_save_competition_track", {
    p_event_id: value.eventId,
    p_track_id: value.trackId,
    p_name: value.name,
    p_sponsor: value.sponsor,
    p_description: value.description,
    p_reviews: value.reviews,
    p_active: value.active,
  })
  if (error) return failure(error)
  revalidatePath("/judging")
  return ok
}

export async function startJudging(eventId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const id = z.guid().safeParse(eventId)
  if (!id.success) return failure({ message: "Invalid event" })
  const { error } = await supabase.rpc("admin_start_judging", {
    p_event_id: id.data,
  })
  if (error) return failure(error)
  revalidatePath("/judging")
  return ok
}
