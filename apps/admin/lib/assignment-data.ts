import "server-only"
import * as z from "zod"

import { requireAdmin } from "./admin"
import { assignmentOverview } from "./assignments"

export async function getAssignmentOverview(eventId: string) {
  const { supabase } = await requireAdmin("organizer")
  const id = z.guid().parse(eventId)
  const { data, error } = await supabase.rpc("admin_assignment_overview", {
    p_event_id: id,
  })
  if (error) throw new Error(error.message)
  return assignmentOverview.parse(data)
}
