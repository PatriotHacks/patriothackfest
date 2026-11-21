import "server-only"

import { cache } from "react"
import * as z from "zod"

import { getApplicant } from "./applicant"

export const judgeEventSchema = z.object({
  event_id: z.guid(),
  slug: z.string(),
  name: z.string(),
  kind: z.enum(["general", "sponsor"]),
  guest: z.boolean(),
  capacity: z.number().int(),
  enabled: z.boolean(),
  judging_started_at: z.string().nullable(),
  judging_close_at: z.string().nullable(),
  briefing_acknowledged_at: z.string().nullable(),
  tracks: z.array(
    z.object({ id: z.guid(), name: z.string(), active: z.boolean() })
  ),
})
export type JudgeEvent = z.infer<typeof judgeEventSchema>

export const getJudgeEvents = cache(async (): Promise<JudgeEvent[]> => {
  const { supabase } = await getApplicant()
  const { data, error } = await supabase.rpc("judge_events")
  if (error) throw new Error(error.message)
  return z.array(judgeEventSchema).parse(data)
})

export async function getJudgeEvent(slug: string): Promise<JudgeEvent | null> {
  const { supabase } = await getApplicant()
  const { data, error } = await supabase.rpc("judge_event_access", {
    p_event_slug: slug,
  })
  if (error) throw new Error(error.message)
  return data === null ? null : judgeEventSchema.parse(data)
}

export async function getProjectSubmissionsCloseAt(eventId: string) {
  const { supabase } = await getApplicant()
  const { data, error } = await supabase
    .from("event_competition_settings")
    .select("project_submissions_close_at")
    .eq("event_id", eventId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.project_submissions_close_at ?? null
}
