import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { ProjectAvailability } from "@/components/project/availability"
import { ProjectCollaborators } from "@/components/project/collaborators"
import { ProjectEditor } from "@/components/project/editor"
import { WithdrawProjectButton } from "@/components/project/withdraw-button"
import { getApplicant } from "@/lib/applicant"
import { getProjectDetail, getProjectEvent } from "@/lib/project-data"
import { canManageProject, projectPhase } from "@/lib/projects"

export default async function ProjectPage({
  params,
}: PageProps<"/projects/[eventSlug]/[projectId]">) {
  const { eventSlug, projectId } = await params
  const event = await getProjectEvent(eventSlug)
  const detail = await getProjectDetail(projectId, event.event_id)
  const { userId } = await getApplicant()
  const editable =
    detail.project.owner_user_id === userId &&
    detail.project.status !== "withdrawn" &&
    canManageProject(event)
  return (
    <div className="flex max-w-3xl flex-col gap-5 text-[#3A4A2B]">
      <Link
        href={`/projects/${encodeURIComponent(event.slug)}`}
        className="text-sm underline"
      >
        Back to event projects
      </Link>
      <h1 className={cn(SERIF, "text-4xl")}>
        {detail.project.name || "Untitled project"}
      </h1>
      <p className="capitalize">
        {detail.project.status} ·{" "}
        {detail.project.owner_user_id === userId
          ? "Project owner"
          : "Collaborator (read-only)"}
      </p>
      <ProjectAvailability event={event} />
      <article className={cn(PAPER, "flex flex-col gap-4 p-6")}>
        {projectPhase(event) !== "scheduled" && (
          <ProjectEditor
            detail={detail}
            editable={editable && projectPhase(event) === "open"}
          />
        )}
        <ProjectCollaborators detail={detail} editable={editable} />
        {editable && <WithdrawProjectButton projectId={projectId} />}
      </article>
    </div>
  )
}
