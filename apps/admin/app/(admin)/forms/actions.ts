"use server"

import { fromZonedInputValue } from "@workspace/forms"
import { roleLabel } from "@workspace/supabase/roles"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"

const createFormInput = z.object({
  eventId: z.guid(),
  role: z.enum(["participant", "volunteer", "judge"]),
})

export async function createForm(eventId: string, role: string) {
  const input = createFormInput.parse({ eventId, role })
  const { supabase } = await requireAdmin("organizer")

  const event = await supabase
    .from("events")
    .select("slug")
    .eq("id", input.eventId)
    .single()
  if (event.error) return failure(event.error)

  const { data, error } = await supabase
    .from("forms")
    .insert({
      event_id: input.eventId,
      role: input.role,
      title: `${roleLabel(input.role, event.data.slug)} application`,
    })
    .select("id")
    .single()
  if (error) return failure(error)

  redirect(`/forms/${data.id}`)
}

const deadlineInput = z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
])

export async function updateDeadlines(
  formId: string,
  submissionsCloseAt: string,
  editsLockAt: string
): Promise<ActionResult> {
  const id = z.guid().parse(formId)
  const close = deadlineInput.parse(submissionsCloseAt)
  const lock = deadlineInput.parse(editsLockAt)
  const { supabase } = await requireAdmin("organizer")

  const { error } = await supabase
    .from("forms")
    .update({
      submissions_close_at: close ? fromZonedInputValue(close) : null,
      edits_lock_at: lock ? fromZonedInputValue(lock) : null,
    })
    .eq("id", id)
  if (error) return failure(error)

  revalidatePath("/forms", "layout")
  return ok
}
