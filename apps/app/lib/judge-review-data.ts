import "server-only"

import { getApplicant } from "./applicant"
import { judgeAssignmentSchema, judgeQueueSchema } from "./judge-reviews"

export async function getJudgeQueue(eventSlug: string) {
  const { supabase } = await getApplicant()
  const { data, error } = await supabase.rpc("judge_queue", {
    p_event_slug: eventSlug,
  })
  if (error) throw new Error(error.message)
  return data === null ? null : judgeQueueSchema.parse(data)
}

export async function getJudgeAssignment(
  eventSlug: string,
  assignmentId: string
) {
  const { supabase } = await getApplicant()
  const { data, error } = await supabase.rpc("judge_assignment", {
    p_event_slug: eventSlug,
    p_assignment_id: assignmentId,
  })
  if (error) throw new Error(error.message)
  return data === null ? null : judgeAssignmentSchema.parse(data)
}
