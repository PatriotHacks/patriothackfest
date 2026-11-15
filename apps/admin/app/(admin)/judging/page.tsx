import { Card, CardContent } from "@workspace/ui/components/card"
import { redirect } from "next/navigation"

import { CompetitionSettingsForm } from "@/components/judging/settings-form"
import { CompetitionTrackForm } from "@/components/judging/track-form"
import { JudgeRoster } from "@/components/judging/judges"
import { SubmittedProjectsList } from "@/components/judging/projects"
import { AssignmentsSection } from "@/components/judging/assignments"
import { ResultsSection } from "@/components/judging/results"
import { EventTabs } from "@/components/event-tabs"
import { PageHeader } from "@/components/page-header"
import { getAdmin } from "@/lib/admin"
import { selectEvent } from "@/lib/events"
import { hasLevel } from "@/lib/levels"
import { judgeRosterSchema } from "@/lib/judges"
import { getSubmittedProjects } from "@/lib/organizer-project-data"
import { parseProjectsPage } from "@/lib/organizer-projects"
import { getAssignmentOverview } from "@/lib/assignment-data"
import { assignmentQueryParams, parseAssignmentQuery } from "@/lib/assignments"
import { getJudgingResults } from "@/lib/judging-results-data"
import { parseResultsQuery, resultsQueryParams } from "@/lib/judging-results"

export default async function JudgingPage({
  searchParams,
}: PageProps<"/judging">) {
  const { supabase, level } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")
  const query = await searchParams
  const { event: slug, projectsPage } = query
  const page = parseProjectsPage(projectsPage)
  const assignmentFilters = parseAssignmentQuery(query)
  const resultsQuery = parseResultsQuery(query)
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
  const invalidResultsContext =
    resultsQuery.invalidContext ||
    (resultsQuery.filters.trackId !== null &&
      !tracks.data.some(
        (track) => track.active && track.id === resultsQuery.filters.trackId
      ))
  const results = invalidResultsContext
    ? null
    : await getJudgingResults(event.id, resultsQuery.filters)
  const resultParams = {
    ...resultsQueryParams(resultsQuery.filters),
    ...(resultsQuery.invalidContext ? { resultsTrack: "unavailable" } : {}),
  }
  const assignmentParams = assignmentQueryParams(assignmentFilters)

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Judging"
        description="Submitted projects, dates, tracks, judge roster, assignments, and results. These do not change admissions applications."
      />
      <EventTabs events={events} selected={event.slug} basePath="/judging" />
      <SubmittedProjectsList
        eventSlug={event.slug}
        page={page}
        data={projects}
        judgingQuery={{ ...assignmentParams, ...resultParams }}
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
        resultsQuery={resultParams}
      />
      <ResultsSection
        eventSlug={event.slug}
        tracks={tracks.data}
        filters={resultsQuery.filters}
        data={results}
        invalidContext={invalidResultsContext}
        projectsPage={page}
        otherQuery={assignmentParams}
      />
      <p className="text-sm text-muted-foreground">
        Participants use /projects and rostered judges use /judge in the
        participant portal. Results are organizer-only; winner decisions are
        manual.
      </p>
    </div>
  )
}
