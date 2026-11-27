import { redirect } from "next/navigation"

import { AwardsManager } from "@/components/awards/awards"
import { EventTabs } from "@/components/event-tabs"
import { PageHeader } from "@/components/page-header"
import { getAdmin } from "@/lib/admin"
import { adminAwardsSchema } from "@/lib/awards"
import { selectEvent } from "@/lib/events"
import { hasLevel } from "@/lib/levels"

const DESCRIPTION =
  "Awards and their winning projects. Winners are listed first in the public gallery, ordered by their best award rank (1 is best)."

export default async function AwardsPage({
  searchParams,
}: PageProps<"/awards">) {
  const { supabase, level } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")
  const { event: slug } = await searchParams
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, slug, name, starts_at, ends_at")
    .order("starts_at", { nullsFirst: false })
    .order("slug")
  if (eventsError) throw new Error(eventsError.message)
  const event = selectEvent(events, typeof slug === "string" ? slug : undefined)
  if (!event)
    return <PageHeader title="Awards" description="No events configured." />

  const [settings, tracks, awards] = await Promise.all([
    supabase
      .from("event_competition_settings")
      .select("gallery_published")
      .eq("event_id", event.id)
      .maybeSingle(),
    supabase
      .from("competition_tracks")
      .select("id, name, active")
      .eq("event_id", event.id)
      .order("name")
      .order("id"),
    supabase.rpc("admin_awards", { p_event_id: event.id }),
  ])
  if (settings.error) throw new Error(settings.error.message)
  if (tracks.error) throw new Error(tracks.error.message)
  if (awards.error) throw new Error(awards.error.message)
  const data = adminAwardsSchema.parse(awards.data)

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader title="Awards" description={DESCRIPTION} />
      <EventTabs events={events} selected={event.slug} basePath="/awards" />
      {settings.data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {settings.data.gallery_published
              ? "The gallery for this event is public. Award changes appear immediately."
              : "The gallery for this event is not published. Publish it in Submission Forms."}
          </p>
          <AwardsManager
            key={event.id}
            eventId={event.id}
            awards={data.awards}
            projects={data.projects}
            tracks={tracks.data}
          />
        </>
      ) : (
        <p className="text-sm">
          Save competition settings in Submission Forms before adding awards.
        </p>
      )}
    </div>
  )
}
