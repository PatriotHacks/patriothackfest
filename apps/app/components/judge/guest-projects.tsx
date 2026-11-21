import { PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { guestProjectHref, type GuestProjects } from "@/lib/judge-reviews"

export function GuestProjectList({
  eventSlug,
  projects,
}: {
  eventSlug: string
  projects: GuestProjects
}) {
  return (
    <section
      className={cn(PAPER, "flex flex-col gap-4 p-6")}
      aria-label="Submitted projects"
    >
      <h2 className="text-xl font-semibold">Submitted projects</h2>
      {projects.length === 0 ? (
        <p>No submitted projects.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id} className="border-t border-[#E7E4D9] pt-3">
              <Link
                href={guestProjectHref(eventSlug, project.id)}
                className="font-semibold break-words underline"
              >
                {project.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function GuestJudgeDetails() {
  return (
    <section className={cn(PAPER, "flex flex-col gap-2 p-6")}>
      <h2 className="text-xl font-semibold">You&apos;re a guest judge</h2>
      <p>
        You can read every submitted project. Guest judges are not assigned
        reviews and do not score.
      </p>
    </section>
  )
}
