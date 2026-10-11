"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { failure, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"

const releaseResult = z.object({ queued: z.number(), undecided: z.number() })

export async function releaseDecisions(
  formId: string
): Promise<ActionResult & { queued?: number; undecided?: number }> {
  const id = z.guid().parse(formId)
  const { supabase } = await requireAdmin("organizer")

  const { data, error } = await supabase.rpc("admin_release_decisions", {
    p_form_id: id,
  })
  if (error) return failure(error)

  revalidatePath("/", "layout")
  return { error: null, ...releaseResult.parse(data) }
}
