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
      <Link href="/projects" className="text-sm underline">
        All project events
      </Link>
      <h1 className={cn(SERIF, "text-4xl")}>{event.name}: projects</h1>
      <ProjectAvailability event={event} />
      {canManageProject(event) && (
        <CreateProjectButton eventId={event.event_id} eventSlug={event.slug} />
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
            {project.owner_user_id === userId ? "Your project" : "Collaborator"}
          </p>
          {project.summary && <p>{project.summary}</p>}
        </Link>
      ))}
    </div>
  )
}
