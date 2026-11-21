import "server-only"

import { getApplicant } from "./applicant"
import {
  guestProjectsSchema,
  judgeAssignmentSchema,
  judgeCriteriaSchema,
  judgeProjectViewSchema,
  judgeQueueSchema,
} from "./judge-reviews"

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

export async function getJudgeCriteria(eventSlug: string) {
  const { supabase } = await getApplicant()
  const { data, error } = await supabase.rpc("judge_criteria", {
    p_event_slug: eventSlug,
  })
  if (error) throw new Error(error.message)
  return data === null ? null : judgeCriteriaSchema.parse(data)
}

export async function acknowledgeJudgeBriefing(eventSlug: string) {
  const { supabase } = await getApplicant()
  const { error } = await supabase.rpc("judge_acknowledge_briefing", {
    p_event_slug: eventSlug,
  })
  if (error) throw new Error(error.message)
}

export async function getGuestProjects(eventSlug: string) {
  const { supabase } = await getApplicant()
  const { data, error } = await supabase.rpc("judge_guest_projects", {
    p_event_slug: eventSlug,
  })
  if (error) throw new Error(error.message)
  return data === null ? null : guestProjectsSchema.parse(data)
}

export async function getGuestProject(eventSlug: string, projectId: string) {
  const { supabase } = await getApplicant()
  const { data, error } = await supabase.rpc("judge_guest_project", {
    p_event_slug: eventSlug,
    p_project_id: projectId,
  })
  if (error) throw new Error(error.message)
  return data === null ? null : judgeProjectViewSchema.parse(data)
}
