import { SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

import { JudgeProjectDetails } from "@/components/judge/project-details"
import { getJudgeEvent } from "@/lib/judge-access"
import { getGuestProject } from "@/lib/judge-review-data"
import { guestProjectRouteSchema } from "@/lib/judge-reviews"

export default async function GuestProjectPage({
  params,
}: PageProps<"/judge/[eventSlug]/projects/[projectId]">) {
  const route = guestProjectRouteSchema.safeParse(await params)
  if (!route.success) notFound()
  const { eventSlug, projectId } = route.data
  const event = await getJudgeEvent(eventSlug)
  if (!event?.guest) notFound()
  const detail = await getGuestProject(eventSlug, projectId)
  if (!detail) notFound()
  return (
    <div className="flex flex-col gap-5">
      <Link className="text-sm underline" href="/judge">
        Back to dashboard
      </Link>
      <p className="text-sm">{event.name}</p>
      <h1 className={cn(SERIF, "text-4xl break-words")}>
        {detail.project.name}
      </h1>
      <JudgeProjectDetails detail={detail} context={null} />
    </div>
  )
}
