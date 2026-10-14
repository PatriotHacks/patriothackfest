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
    supabase
      .from("applications")
      .select(
        "id, event_id, status, forms(status, submissions_close_at, edits_lock_at, decisions_released_at)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ])
  if (events.error) throw new Error(events.error.message)
  if (forms.error) throw new Error(forms.error.message)
  if (applications.error) throw new Error(applications.error.message)

  const now = Date.now()
  const draft = applications.data.find(
    (a) => a.status === "draft" && isFormOpen(a.forms, now)
  )
  if (draft) redirect(`/draft/${draft.id}`)

  const openEvent = events.data.find((e) =>
    forms.data.some((f) => f.event_id === e.id && isFormOpen(f, now))
  )
  const applied = (eventId: string) =>
    applications.data.find((a) => a.event_id === eventId)
  if (openEvent && !applied(openEvent.id)) redirect(`/apply/${openEvent.slug}`)
  if (applications.data.some((a) => a.status !== "draft")) redirect("/")

  const event = openEvent ?? upcomingEvent(events.data, now)
  if (!event) redirect("/closed")
  const application = applied(event.id)
  redirect(application ? `/draft/${application.id}` : `/apply/${event.slug}`)
}
