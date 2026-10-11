import { formatInZone, publishedSchemaSchema } from "@workspace/forms"
import { notFound, redirect } from "next/navigation"

import { RolePicker } from "@/components/role-picker"
import { isFormOpen } from "@/lib/application-status"
import { getNamedApplicant } from "@/lib/applicant"
import { ROLES } from "@/lib/roles"

const formSummary = publishedSchemaSchema.pick({
  title: true,
  description: true,
})

export default async function ApplyPage({
  params,
}: PageProps<"/apply/[eventSlug]">) {
  const { eventSlug } = await params
  const { supabase, userId } = await getNamedApplicant()

  const { data: event, error } = await supabase
    .from("events")
    .select("id, name")
    .eq("slug", eventSlug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!event) notFound()

  const [existing, forms] = await Promise.all([
    supabase
      .from("applications")
      .select("id")
      .eq("event_id", event.id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("forms")
      .select(
        "id, role, status, submissions_close_at, edits_lock_at, decisions_released_at, title:published_schema->>title, description:published_schema->>description"
      )
      .eq("event_id", event.id)
      .eq("status", "published"),
  ])
  if (existing.error) throw new Error(existing.error.message)
  if (forms.error) throw new Error(forms.error.message)
  if (existing.data) redirect(`/applications/${existing.data.id}`)

  const now = Date.now()
  const open = forms.data
    .filter((f) => isFormOpen(f, now))
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))
    .map((f) => ({
      id: f.id,
      role: f.role,
      ...formSummary.parse({ title: f.title, description: f.description }),
      closesAt: formatInZone(f.submissions_close_at!),
    }))

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Apply to {event.name}</h1>
        <p className="text-muted-foreground">
          Choose the role you want to apply for. You can apply for one role per
          event.
        </p>
      </div>
      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Applications for this event are closed.
        </p>
      ) : (
        <RolePicker eventName={event.name} forms={open} />
      )}
    </div>
  )
}
