import { Card, CardContent } from "@workspace/ui/components/card"
import { redirect } from "next/navigation"

import { JudgingCriteria } from "@/components/judging/criteria"
import { JudgingSettingsForm } from "@/components/judging/settings-form"
import { JudgeRoster } from "@/components/judging/judges"
import { JudgeWorkload } from "@/components/judging/workload"
import { AssignmentsSection } from "@/components/judging/assignments"
import { ResultsSection } from "@/components/judging/results"
import { EventTabs } from "@/components/event-tabs"
import { PageHeader } from "@/components/page-header"
import { getAdmin } from "@/lib/admin"
import { selectEvent } from "@/lib/events"
import { hasLevel } from "@/lib/levels"
import { judgeRosterSchema } from "@/lib/judges"
import { judgingCriteriaSchema } from "@/lib/judging-criteria"
import { parseProjectsPage } from "@/lib/organizer-projects"
import { getEventProjects } from "@/lib/organizer-project-data"
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
    return (
      <PageHeader
        title="Judging Management"
        description="No events configured."
      />
    )

  const [settings, tracks, roster, criteria, assignments, projects] =
    await Promise.all([
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
      supabase.rpc("admin_judging_criteria", { p_event_id: event.id }),
      getAssignmentOverview(event.id, assignmentFilters),
      getEventProjects(event.id, { status: "submitted", page: 1 }),
    ])
  if (settings.error) throw new Error(settings.error.message)
  if (tracks.error) throw new Error(tracks.error.message)
  if (roster.error) throw new Error(roster.error.message)
  if (criteria.error) throw new Error(criteria.error.message)
  const started = Boolean(settings.data?.judging_started_at)
  const judges = judgeRosterSchema.parse(roster.data)
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
        title="Judging Management"
        description="Judging deadline, rubric, judge roster, assignments, and results. Submission dates, tracks, questions, and submitted projects are in Submission Forms."
      />
      <EventTabs events={events} selected={event.slug} basePath="/judging" />
      <Card>
        <CardContent>
          <JudgingSettingsForm
            key={event.id}
            eventId={event.id}
            settings={settings.data}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <JudgingCriteria
            key={event.id}
            eventId={event.id}
            criteria={judgingCriteriaSchema.parse(criteria.data)}
            locked={started}
          />
        </CardContent>
      </Card>
      {settings.data && (
        <JudgeRoster
          eventId={event.id}
          tracks={tracks.data}
          judges={judges}
          started={started}
        />
      )}
      {settings.data && (
        <Card>
          <CardContent>
            <JudgeWorkload
              key={event.id}
              projects={projects.counts.submitted}
              reviewsPerProject={settings.data.general_reviews_per_project}
              capacities={judges
                .filter((judge) => judge.active && judge.kind === "general")
                .map((judge) => judge.capacity)}
            />
          </CardContent>
        </Card>
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
