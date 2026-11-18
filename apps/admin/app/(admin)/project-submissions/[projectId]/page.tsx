import { redirect } from "next/navigation"

import { ProjectDetails } from "@/components/project-submissions/project-details"
import { getAdmin } from "@/lib/admin"
import { hasLevel } from "@/lib/levels"
import { getProject } from "@/lib/organizer-project-data"
import { parseProjectsPage, parseProjectStatus } from "@/lib/organizer-projects"

export default async function ProjectPage({
  params,
  searchParams,
}: PageProps<"/project-submissions/[projectId]">) {
  const { level } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")
  const { projectId } = await params
  const { event: slug, status, projectsPage } = await searchParams
  const { event, detail } = await getProject(slug, projectId)
  return (
    <ProjectDetails
      event={event}
      detail={detail}
      query={{
        status: parseProjectStatus(status),
        page: parseProjectsPage(projectsPage),
      }}
    />
  )
}
