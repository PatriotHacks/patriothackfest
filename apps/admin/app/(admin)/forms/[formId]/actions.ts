"use server"

import {
  fieldSchema,
  fieldTypeSchema,
  isChoiceType,
  type Field,
} from "@workspace/forms"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"

const detailsInput = z.object({
  title: z.string(),
  description: z.string().nullable(),
})

export async function updateFormDetails(
  formId: string,
  details: { title: string; description: string | null }
): Promise<ActionResult> {
  const id = z.guid().parse(formId)
  const input = detailsInput.parse(details)
  const { supabase } = await requireAdmin("organizer")

  const { error } = await supabase.from("forms").update(input).eq("id", id)
  return error ? failure(error) : ok
}

export async function addField(
  formId: string,
  type: string,
  position: number
): Promise<ActionResult & { field?: Field }> {
  const id = z.guid().parse(formId)
  const fieldType = fieldTypeSchema.parse(type)
  const pos = z.int().parse(position)
  const { supabase } = await requireAdmin("organizer")

  const { data, error } = await supabase
    .from("form_fields")
    .insert({
      form_id: id,
      position: pos,
      type: fieldType,
      label: "",
      options: isChoiceType(fieldType) ? [] : null,
    })
    .select(
      "id, type, label, help_text, required, options, validation, condition"
    )
    .single()
  if (error) return failure(error)

  return { error: null, field: fieldSchema.parse(data) }
}

export async function saveField(field: Field): Promise<ActionResult> {
  const parsed = fieldSchema.safeParse(field)
  if (!parsed.success) return { error: "Invalid question settings" }
  const {
    id,
    type,
    label,
    help_text,
    required,
    options,
    validation,
    condition,
  } = parsed.data
  const { supabase } = await requireAdmin("organizer")

  const { data, error } = await supabase
    .from("form_fields")
    .update({
      type,
      label,
      help_text,
      required,
      options,
      validation,
      condition,
    })
    .eq("id", id)
    .select("id")
  if (error) return failure(error)
  if (data.length === 0) return { error: "Question not found" }
  return ok
}

export async function archiveField(fieldId: string): Promise<ActionResult> {
  const id = z.guid().parse(fieldId)
  const { supabase } = await requireAdmin("organizer")

  const { error } = await supabase
    .from("form_fields")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
  return error ? failure(error) : ok
}
