import { redirect } from "next/navigation"

import { EventTabs } from "@/components/event-tabs"
import { PageHeader } from "@/components/page-header"
import { ProjectsList } from "@/components/project-submissions/projects-list"
import { getAdmin } from "@/lib/admin"
import { selectEvent } from "@/lib/events"
import { hasLevel } from "@/lib/levels"
import { getEventProjects } from "@/lib/organizer-project-data"
import { parseProjectsPage, parseProjectStatus } from "@/lib/organizer-projects"

export default async function ProjectSubmissionsPage({
  searchParams,
}: PageProps<"/project-submissions">) {
  const { supabase, level } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")
  const { event: slug, status, projectsPage } = await searchParams
  const query = {
    status: parseProjectStatus(status),
    page: parseProjectsPage(projectsPage),
  }
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
        title="Project Submissions"
        description="No events configured."
      />
    )
  const data = await getEventProjects(event.id, query)

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Project Submissions"
        description="Every project for this event, including drafts still in progress. Read-only. Times are in America/New_York."
      />
      <EventTabs
        events={events}
        selected={event.slug}
        basePath="/project-submissions"
      />
      <ProjectsList eventSlug={event.slug} query={query} data={data} />
    </div>
  )
}
