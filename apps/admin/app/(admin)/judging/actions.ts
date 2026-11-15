"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import { saveCompetitionSettingsPatch } from "@/lib/competition-settings"
import { judgingSettingsInput, type JudgingSettingsInput } from "@/lib/judging"

export async function saveJudgingSettings(
  input: JudgingSettingsInput
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = judgingSettingsInput.safeParse(input)
  if (!parsed.success)
    return failure({
      message: parsed.error.issues[0]?.message ?? "Invalid settings",
    })
  const result = await saveCompetitionSettingsPatch(supabase, parsed.data)
  if (result.error) return result
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
  revalidatePath("/submission-forms")
  return ok
}
