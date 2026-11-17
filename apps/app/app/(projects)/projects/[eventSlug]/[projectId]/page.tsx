import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { ProjectAvailability } from "@/components/project/availability"
import { ProjectEditor } from "@/components/project/editor"
import { ProjectTeam } from "@/components/project/team"
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
  const isOwner = detail.project.owner_user_id === userId
  const editable =
    detail.project.status !== "withdrawn" && canManageProject(event)
  const eventHref = `/projects/${encodeURIComponent(event.slug)}`
  return (
    <div className="flex max-w-3xl flex-col gap-5 text-[#3A4A2B]">
      <Link href={eventHref} className="text-sm underline">
        Back to event projects
      </Link>
      <h1 className={cn(SERIF, "text-4xl")}>
        {detail.project.name || "Untitled project"}
      </h1>
      <p className="capitalize">
        {detail.project.status} · {isOwner ? "Project owner" : "Team member"}
      </p>
      <ProjectAvailability event={event} />
      <article className={cn(PAPER, "flex flex-col gap-4 p-6")}>
        <ProjectTeam
          detail={detail}
          userId={userId}
          editable={editable}
          eventHref={eventHref}
        />
        {projectPhase(event) !== "scheduled" && (
          <ProjectEditor
            detail={detail}
            editable={editable && projectPhase(event) === "open"}
          />
        )}
        {editable && isOwner && <WithdrawProjectButton projectId={projectId} />}
      </article>
    </div>
  )
}
