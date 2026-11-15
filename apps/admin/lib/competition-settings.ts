import "server-only"

import type { ServerClient } from "@workspace/supabase/server"

import { failure, ok, type ActionResult } from "./action-result"
import {
  competitionDates,
  competitionSettingsInput,
  competitionSettingsValues,
  type CompetitionSettingsInput,
} from "./judging"

// Submission and judging settings share one row and RPC; each form saves its
// own fields over the currently stored values of the other.
export async function saveCompetitionSettingsPatch(
  supabase: ServerClient,
  patch: Partial<CompetitionSettingsInput> & { eventId: string }
): Promise<ActionResult> {
  const { data, error: readError } = await supabase
    .from("event_competition_settings")
    .select("*")
    .eq("event_id", patch.eventId)
    .maybeSingle()
  if (readError) return failure(readError)
  const parsed = competitionSettingsInput.safeParse({
    ...competitionSettingsValues(patch.eventId, data),
    ...patch,
  })
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
  return ok
}
