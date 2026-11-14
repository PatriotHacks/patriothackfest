import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { getProjectEvents } from "@/lib/project-data"

export default async function ProjectsPage() {
  const events = await getProjectEvents()
  return (
    <div className="flex max-w-3xl flex-col gap-5 text-[#3A4A2B]">
      <h1 className={cn(SERIF, "text-4xl")}>Projects</h1>
      <p>
        Submit a project for your hackathon. Informal teams can list their
        collaborators on the project.
      </p>
      {events.length === 0 ? (
        <div className={cn(PAPER, "p-6")}>
          No project submissions are available for your account right now. Check
          that the event has enabled submissions and that you submitted an
          application and were accepted.
        </div>
      ) : (
        events.map((event) => (
          <Link
            key={event.event_id}
            href={`/projects/${encodeURIComponent(event.slug)}`}
            className={cn(PAPER, "p-6 underline-offset-4 hover:underline")}
          >
            {event.name}
          </Link>
        ))
      )}
    </div>
  )
}
