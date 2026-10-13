import { formatInZone } from "@workspace/forms"
import { ROLES } from "@workspace/supabase/roles"
import { notFound, redirect } from "next/navigation"

import { AuthCard } from "@/components/auth/auth-card"
import { SignOutLink } from "@/components/auth/sign-out-link"
import { RolePicker, type RoleOption } from "@/components/role-picker"
import { isFormOpen } from "@/lib/application-status"
import { getNamedApplicant } from "@/lib/applicant"

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
        "id, role, status, submissions_close_at, edits_lock_at, decisions_released_at"
      )
      .eq("event_id", event.id)
      .eq("status", "published"),
  ])
  if (existing.error) throw new Error(existing.error.message)
  if (forms.error) throw new Error(forms.error.message)
  if (existing.data) redirect(`/applications/${existing.data.id}`)

  const now = Date.now()
  const options = ROLES.map((role): RoleOption => {
    const form = forms.data.find((f) => f.role === role)
    if (!form) return { role, status: "not_open" }
    if (!isFormOpen(form, now)) return { role, status: "closed" }
    return {
      role,
      status: "open",
      formId: form.id,
      closesAt: formatInZone(form.submissions_close_at!),
    }
  })

  return (
    <AuthCard
      title={`Apply to ${event.name}`}
      description="Choose the role you want to apply for."
    >
      <RolePicker options={options} />
      <SignOutLink />
    </AuthCard>
  )
}
