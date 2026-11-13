import { Card, CardContent } from "@workspace/ui/components/card"
import { redirect } from "next/navigation"

import { CompetitionSettingsForm } from "@/components/judging/settings-form"
import { CompetitionTrackForm } from "@/components/judging/track-form"
import { EventTabs } from "@/components/event-tabs"
import { PageHeader } from "@/components/page-header"
import { getAdmin } from "@/lib/admin"
import { selectEvent } from "@/lib/events"
import { hasLevel } from "@/lib/levels"

export default async function JudgingPage({
  searchParams,
}: PageProps<"/judging">) {
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
    return <PageHeader title="Judging" description="No events configured." />

  const [settings, tracks] = await Promise.all([
    supabase
      .from("event_competition_settings")
      .select("*")
      .eq("event_id", event.id)
      .maybeSingle(),
    supabase
      .from("competition_tracks")
      .select("*")
      .eq("event_id", event.id)
      .order("created_at")
      .order("id"),
  ])
  if (settings.error) throw new Error(settings.error.message)
  if (tracks.error) throw new Error(tracks.error.message)
  const started = Boolean(settings.data?.judging_started_at)

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Judging"
        description="Project submission dates and sponsor tracks. These do not change admissions applications."
      />
      <EventTabs events={events} selected={event.slug} basePath="/judging" />
      <Card>
        <CardContent>
          <CompetitionSettingsForm
            key={event.id}
            eventId={event.id}
            settings={settings.data}
          />
        </CardContent>
      </Card>
      <section className="flex flex-col gap-4" aria-labelledby="tracks-heading">
        <h2 id="tracks-heading" className="text-xl font-semibold">
          Sponsor tracks
        </h2>
        <p className="text-sm text-muted-foreground">
          All submitted projects enter general judging. Participants may also
          select multiple active sponsor tracks.
        </p>
        {!settings.data ? (
          <p className="text-sm text-muted-foreground">
            Save event settings before adding tracks.
          </p>
        ) : (
          <>
            {tracks.data.map((track) => (
              <Card key={track.id}>
                <CardContent>
                  <CompetitionTrackForm
                    eventId={event.id}
                    track={track}
                    locked={started}
                  />
                </CardContent>
              </Card>
            ))}
            {!started && (
              <Card>
                <CardContent>
                  <CompetitionTrackForm
                    key={`new-${event.id}`}
                    eventId={event.id}
                    locked={false}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>
      <p className="text-sm text-muted-foreground">
        Project submission pages, judge access, assignments, and results are not
        part of this initial settings release.
      </p>
    </div>
  )
}
