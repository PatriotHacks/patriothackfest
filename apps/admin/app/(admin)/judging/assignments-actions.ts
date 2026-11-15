"use server"

import { revalidatePath } from "next/cache"
import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import {
  addAssignmentInput,
  assignmentCandidates,
  assignmentContextInput,
  assignmentEventInput,
  cancelAssignmentInput,
  generationSummary,
  reassignAssignmentInput,
  type AssignmentCandidate,
  type GenerationSummary,
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

export async function cancelAssignment(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = cancelAssignmentInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid assignment" })
  const { error } = await supabase.rpc("admin_cancel_assignment", {
    p_event_id: parsed.data.eventId,
    p_assignment_id: parsed.data.assignmentId,
  })
  if (error) return failure(error)
  revalidatePath("/judging")
  return ok
}

export async function reassignAssignment(
  input: unknown
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = reassignAssignmentInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid assignment" })
  const { error } = await supabase.rpc("admin_reassign_assignment", {
    p_event_id: parsed.data.eventId,
    p_assignment_id: parsed.data.assignmentId,
    p_judge_id: parsed.data.judgeId,
  })
  if (error) return failure(error)
  revalidatePath("/judging")
  return ok
}
