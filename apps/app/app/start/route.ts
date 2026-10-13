import { redirect } from "next/navigation"

import { isFormOpen } from "@/lib/application-status"
import { getNamedApplicant } from "@/lib/applicant"

export async function GET() {
  const { supabase, userId } = await getNamedApplicant()

  const [events, forms] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug")
      .order("starts_at", { nullsFirst: false })
      .order("slug"),
    supabase
      .from("forms")
      .select(
        "event_id, status, submissions_close_at, edits_lock_at, decisions_released_at"
      )
      .eq("status", "published"),
  ])
  if (events.error) throw new Error(events.error.message)
  if (forms.error) throw new Error(forms.error.message)

  const now = Date.now()
  const event = events.data.find((e) =>
    forms.data.some((f) => f.event_id === e.id && isFormOpen(f, now))
  )
  if (!event) redirect("/")

  const { data: application, error } = await supabase
    .from("applications")
    .select("id")
    .eq("event_id", event.id)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error(error.message)

  redirect(
    application ? `/applications/${application.id}` : `/apply/${event.slug}`
  )
}
