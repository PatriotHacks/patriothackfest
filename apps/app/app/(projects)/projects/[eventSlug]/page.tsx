import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { ProjectAvailability } from "@/components/project/availability"
import { CreateProjectButton } from "@/components/project/create-project-button"
import { getApplicant } from "@/lib/applicant"
import { getProjectEvent } from "@/lib/project-data"
import { canManageProject } from "@/lib/projects"

export default async function EventProjectsPage({
  params,
}: PageProps<"/projects/[eventSlug]">) {
  const { eventSlug } = await params
  const event = await getProjectEvent(eventSlug)
  const { supabase, userId } = await getApplicant()
  const { data: projects, error } = await supabase.rpc("participant_projects", {
    p_event_id: event.event_id,
  })
  if (error) throw new Error(error.message)
  return (
    <div className="flex max-w-3xl flex-col gap-5 text-[#3A4A2B]">
      <h1 className={cn(SERIF, "text-4xl")}>Project Submission</h1>
      <p>
        Submit a project for {event.name}. Build it solo or as a team; you can
        be on one team per event.
      </p>
      <ProjectAvailability event={event} />
      {canManageProject(event) &&
        !projects.some((project) => project.status !== "withdrawn") && (
          <CreateProjectButton
            eventId={event.event_id}
            eventSlug={event.slug}
          />
        )}
      {projects.length === 0 && <p>You have no projects for this event yet.</p>}
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/projects/${encodeURIComponent(event.slug)}/${project.id}`}
          className={cn(PAPER, "flex flex-col gap-2 p-6 hover:underline")}
        >
          <h2 className="text-xl font-semibold">
            {project.name || "Untitled project"}
          </h2>
          <p className="text-sm capitalize">
            {project.status} ·{" "}
            {project.owner_user_id === userId ? "Your project" : "Team member"}
          </p>
        </Link>
      ))}
    </div>
  )
}
