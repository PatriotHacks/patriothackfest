import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import { redirect } from "next/navigation"

import { getCurrentProjectEvent } from "@/lib/project-data"

export default async function ProjectSubmissionPage() {
  const event = await getCurrentProjectEvent()
  if (event) redirect(`/projects/${encodeURIComponent(event.slug)}`)
  return (
    <div className="flex max-w-3xl flex-col gap-5 text-[#3A4A2B]">
      <h1 className={cn(SERIF, "text-4xl")}>Project Submission</h1>
      <div className={cn(PAPER, "p-6")}>
        No project submission is open right now.
      </div>
    </div>
  )
}
