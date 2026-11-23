"use server"

import { revalidatePath } from "next/cache"
import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import {
  addAssignmentInput,
  assignmentCandidates,
  assignmentContextInput,
  assignmentEventInput,
  generationSummary,
  rebalancePlan,
  type AssignmentCandidate,
  type GenerationSummary,
  type RebalancePlan,
} from "@/lib/assignments"

export async function generateAssignments(
  input: unknown
): Promise<ActionResult & { summary?: GenerationSummary }> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = assignmentEventInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid event" })
  const { data, error } = await supabase.rpc("admin_generate_assignments", {
    p_event_id: parsed.data.eventId,
  })
  if (error) return failure(error)
  const summary = generationSummary.parse(data)
  revalidatePath("/judging")
  return { error: null, summary }
}

export async function previewRebalanceAssignments(
  input: unknown
): Promise<ActionResult & { plan?: RebalancePlan }> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = assignmentEventInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid event" })
  const { data, error } = await supabase.rpc(
    "admin_rebalance_assignments_preview",
    { p_event_id: parsed.data.eventId }
  )
  if (error) return failure(error)
  return { error: null, plan: rebalancePlan.parse(data) }
}

export async function rebalanceAssignments(
  input: unknown
): Promise<ActionResult & { plan?: RebalancePlan }> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = assignmentEventInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid event" })
  const { data, error } = await supabase.rpc("admin_rebalance_assignments", {
    p_event_id: parsed.data.eventId,
  })
  if (error) return failure(error)
  const plan = rebalancePlan.parse(data)
  revalidatePath("/judging")
  return { error: null, plan }
}

export async function getAssignmentCandidates(
  input: unknown
): Promise<ActionResult & { candidates?: AssignmentCandidate[] }> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = assignmentContextInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid assignment context" })
  const { eventId, projectId, trackId } = parsed.data
  const { data, error } = await supabase.rpc("admin_assignment_candidates", {
    p_event_id: eventId,
    p_project_id: projectId,
    p_track_id: trackId ?? undefined,
  })
  if (error) return failure(error)
  return { error: null, candidates: assignmentCandidates.parse(data) }
}

export async function addAssignment(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = addAssignmentInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid assignment" })
  const { eventId, projectId, trackId, judgeId } = parsed.data
  const { error } = await supabase.rpc("admin_add_assignment", {
    p_event_id: eventId,
    p_project_id: projectId,
    p_track_id: trackId ?? undefined,
    p_judge_id: judgeId,
  })
  if (error) return failure(error)
  revalidatePath("/judging")
  return ok
}
