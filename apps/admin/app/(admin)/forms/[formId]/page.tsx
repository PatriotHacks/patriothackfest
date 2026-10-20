import { fieldSchema } from "@workspace/forms"
import { notFound } from "next/navigation"

import { FormBuilder } from "@/components/builder/form-builder"
import { getAdmin } from "@/lib/admin"
import { hasLevel } from "@/lib/levels"

export default async function FormBuilderPage({
  params,
}: PageProps<"/forms/[formId]">) {
  const { formId } = await params
  const { supabase, level } = await getAdmin()

  const { data: form, error } = await supabase
    .from("forms")
    .select(
      "id, role, title, description, status, published_at, content_updated_at, submissions_close_at, edits_lock_at, events (name, slug)"
    )
    .eq("id", formId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!form) notFound()

  const [fields, answered] = await Promise.all([
    supabase
      .from("form_fields")
      .select(
        "id, type, label, help_text, required, options, validation, condition, editable_after_submit"
      )
      .eq("form_id", formId)
      .is("archived_at", null)
      .order("position")
      .order("created_at")
      .order("id"),
    supabase.rpc("form_answered_field_ids", { p_form_id: formId }),
  ])
  if (fields.error) throw new Error(fields.error.message)
  if (answered.error) throw new Error(answered.error.message)

  return (
    <FormBuilder
      key={form.id}
      form={form}
      eventName={form.events.name}
      eventSlug={form.events.slug}
      initialFields={fields.data.map((f) => fieldSchema.parse(f))}
      answeredFieldIds={answered.data}
      canEdit={hasLevel(level, "organizer")}
    />
  )
}
