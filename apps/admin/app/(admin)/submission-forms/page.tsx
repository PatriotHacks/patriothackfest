import { Card, CardContent } from "@workspace/ui/components/card"
import { redirect } from "next/navigation"

import { CompetitionTrackForm } from "@/components/judging/track-form"
import { SubmittedProjectsList } from "@/components/judging/projects"
import { JudgeVisibilityToggle } from "@/components/submission-forms/judge-visibility"
import { ProjectQuestions } from "@/components/submission-forms/questions"
import { SubmissionSettingsForm } from "@/components/submission-forms/settings-form"
import { EventTabs } from "@/components/event-tabs"
import { PageHeader } from "@/components/page-header"
import { getAdmin } from "@/lib/admin"
import { selectEvent } from "@/lib/events"
import { adminProjectQuestionsSchema } from "@/lib/judging"
import { hasLevel } from "@/lib/levels"
import { getSubmittedProjects } from "@/lib/organizer-project-data"
import { parseProjectsPage } from "@/lib/organizer-projects"

export default async function SubmissionFormsPage({
  searchParams,
}: PageProps<"/submission-forms">) {
  const { supabase, level } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")
  const { event: slug, projectsPage } = await searchParams
  const page = parseProjectsPage(projectsPage)
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
        title="Submission Forms"
        description="No events configured."
      />
    )

  const [settings, tracks, questions, projects] = await Promise.all([
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
    supabase.rpc("admin_project_questions", { p_event_id: event.id }),
    getSubmittedProjects(event.id, page),
  ])
  if (settings.error) throw new Error(settings.error.message)
  if (tracks.error) throw new Error(tracks.error.message)
  if (questions.error) throw new Error(questions.error.message)
  const started = Boolean(settings.data?.judging_started_at)

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Submission Forms"
        description="Project submission dates, sponsor tracks, project questions, and submitted projects. These do not change admissions applications."
      />
      <EventTabs
        events={events}
        selected={event.slug}
        basePath="/submission-forms"
      />
      <Card>
        <CardContent>
          <SubmissionSettingsForm
            key={event.id}
            eventId={event.id}
            settings={settings.data}
          />
        </CardContent>
      </Card>
      <section
        className="flex flex-col gap-4"
        aria-labelledby="questions-heading"
      >
        <h2 id="questions-heading" className="text-xl font-semibold">
          Project questions
        </h2>
        <p className="text-sm text-muted-foreground">
          Shown on every project form for this event. Required questions apply
          when a project is submitted or a submitted project is saved; adding
          one later does not unsubmit existing projects. Archived questions are
          hidden everywhere.
        </p>
        <ProjectQuestions
          key={`questions-${event.id}`}
          eventId={event.id}
          questions={adminProjectQuestionsSchema.parse(questions.data)}
          locked={started}
        />
        {settings.data ? (
          <JudgeVisibilityToggle
            key={`visibility-${event.id}`}
            eventId={event.id}
            enabled={settings.data.judges_see_answers}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Save event settings before choosing whether judges see answers.
          </p>
        )}
      </section>
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
      <SubmittedProjectsList
        eventSlug={event.slug}
        page={page}
        data={projects}
      />
    </div>
  )
}
