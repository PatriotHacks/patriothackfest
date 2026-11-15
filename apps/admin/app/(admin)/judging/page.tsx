import { Card, CardContent } from "@workspace/ui/components/card"
import { redirect } from "next/navigation"

import { CompetitionSettingsForm } from "@/components/judging/settings-form"
import { CompetitionTrackForm } from "@/components/judging/track-form"
import { JudgeRoster } from "@/components/judging/judges"
import { SubmittedProjectsList } from "@/components/judging/projects"
import { AssignmentsSection } from "@/components/judging/assignments"
import { EventTabs } from "@/components/event-tabs"
import { PageHeader } from "@/components/page-header"
import { getAdmin } from "@/lib/admin"
import { selectEvent } from "@/lib/events"
import { hasLevel } from "@/lib/levels"
import { judgeRosterSchema } from "@/lib/judges"
import { getSubmittedProjects } from "@/lib/organizer-project-data"
import { parseProjectsPage } from "@/lib/organizer-projects"
import { getAssignmentOverview } from "@/lib/assignment-data"
import { parseAssignmentQuery } from "@/lib/assignments"

export default async function JudgingPage({
  searchParams,
}: PageProps<"/judging">) {
  const { supabase, level } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")
  const query = await searchParams
  const { event: slug, projectsPage } = query
  const page = parseProjectsPage(projectsPage)
  const assignmentFilters = parseAssignmentQuery(query)
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, slug, name, starts_at, ends_at")
    .order("starts_at", { nullsFirst: false })
    .order("slug")
  if (eventsError) throw new Error(eventsError.message)
  const event = selectEvent(events, typeof slug === "string" ? slug : undefined)
  if (!event)
    return <PageHeader title="Judging" description="No events configured." />

  const [settings, tracks, roster, projects, assignments] = await Promise.all([
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
    supabase.rpc("admin_judge_roster", { p_event_id: event.id }),
    getSubmittedProjects(event.id, page),
    getAssignmentOverview(event.id, assignmentFilters),
  ])
  if (settings.error) throw new Error(settings.error.message)
  if (tracks.error) throw new Error(tracks.error.message)
  if (roster.error) throw new Error(roster.error.message)
  const started = Boolean(settings.data?.judging_started_at)

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Judging"
        description="Submitted projects, dates, tracks, judge roster, and assignments. These do not change admissions applications."
      />
      <EventTabs events={events} selected={event.slug} basePath="/judging" />
      <SubmittedProjectsList
        eventSlug={event.slug}
        page={page}
        data={projects}
      />
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
      {settings.data && (
        <JudgeRoster
          eventId={event.id}
          tracks={tracks.data}
          judges={judgeRosterSchema.parse(roster.data)}
        />
      )}
      <AssignmentsSection
        eventId={event.id}
        eventSlug={event.slug}
        started={started}
        data={assignments}
        filters={assignmentFilters}
        projectsPage={page}
      />
      <p className="text-sm text-muted-foreground">
        Participants use /projects and rostered judges use /judge in the
        participant portal. Judge queues, scorecards, and results are separate
        follow-up work.
      </p>
    </div>
  )
}
