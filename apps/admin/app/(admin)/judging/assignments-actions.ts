"use server"

import { revalidatePath } from "next/cache"
import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import {
  assignmentEventInput,
  generationSummary,
  rebalancePlan,
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
