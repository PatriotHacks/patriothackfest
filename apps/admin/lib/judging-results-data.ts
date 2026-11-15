import "server-only"
import * as z from "zod"

import { requireAdmin } from "./admin"
import { judgingResults, resultsFilters } from "./judging-results"

export async function getJudgingResults(eventId: string, input: unknown) {
  const { supabase } = await requireAdmin("organizer")
  const id = z.guid().parse(eventId)
  const filters = resultsFilters.parse(input)
  const { data, error } = await supabase.rpc("admin_judging_results", {
    p_event_id: id,
    p_track_id: filters.trackId ?? undefined,
    p_page: filters.page,
  })
  if (error) throw new Error(error.message)
  const results = judgingResults.parse(data)
  if (results.track_id !== filters.trackId)
    throw new Error("Results context does not match the requested track")
  return results
}
