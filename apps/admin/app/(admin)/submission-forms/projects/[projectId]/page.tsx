import { redirect } from "next/navigation"

import { SubmittedProjectDetails } from "@/components/judging/project-details"
import { getAdmin } from "@/lib/admin"
import { hasLevel } from "@/lib/levels"
import { getSubmittedProject } from "@/lib/organizer-project-data"
import { parseProjectsPage } from "@/lib/organizer-projects"

export default async function SubmittedProjectPage({
  params,
  searchParams,
}: PageProps<"/submission-forms/projects/[projectId]">) {
  const { level } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")
  const { projectId } = await params
  const { event: slug, projectsPage } = await searchParams
  const { event, detail } = await getSubmittedProject(slug, projectId)
  return (
    <SubmittedProjectDetails
      event={event}
      detail={detail}
      page={parseProjectsPage(projectsPage)}
    />
  )
}
