import "server-only"
import * as z from "zod"

import { requireAdmin } from "./admin"
import { assignmentFilters, assignmentOverview } from "./assignments"

export async function getAssignmentOverview(eventId: string, input: unknown) {
  const { supabase } = await requireAdmin("organizer")
  const id = z.guid().parse(eventId)
  const filters = assignmentFilters.parse(input)
  const { data, error } = await supabase.rpc("admin_assignment_overview", {
    p_event_id: id,
    p_coverage_page: filters.coveragePage,
    p_assignment_page: filters.assignmentPage,
    p_project_id: filters.projectId,
    p_status: filters.status,
  })
  if (error) throw new Error(error.message)
  return assignmentOverview.parse(data)
}
