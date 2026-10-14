import { upcomingEvent } from "@workspace/forms"
import { redirect } from "next/navigation"

import { isFormOpen } from "@/lib/application-status"
import { getNamedApplicant } from "@/lib/applicant"

export async function GET() {
  const { supabase, userId } = await getNamedApplicant()

  const [events, forms, applications] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, starts_at, ends_at")
      .order("starts_at", { nullsFirst: false })
      .order("slug"),
    supabase
      .from("forms")
      .select(
        "event_id, status, submissions_close_at, edits_lock_at, decisions_released_at"
      )
      .eq("status", "published"),
    supabase.from("applications").select("id, event_id").eq("user_id", userId),
  ])
  if (events.error) throw new Error(events.error.message)
  if (forms.error) throw new Error(forms.error.message)
  if (applications.error) throw new Error(applications.error.message)

  const now = Date.now()
  const openEvent = events.data.find((e) =>
    forms.data.some((f) => f.event_id === e.id && isFormOpen(f, now))
  )
  if (!openEvent && applications.data.length > 0) redirect("/")

  const event = openEvent ?? upcomingEvent(events.data, now)
  if (!event) redirect("/")

  const application = applications.data.find((a) => a.event_id === event.id)
  redirect(
    application ? `/applications/${application.id}` : `/apply/${event.slug}`
  )
}
