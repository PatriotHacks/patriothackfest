import Link from "next/link"

import { cn } from "@workspace/ui/lib/utils"

import type { GalleryProjectCard } from "@/lib/gallery"
import { AwardBadges, TrackChips } from "./badges"

export function ProjectCard({
  eventSlug,
  project,
}: {
  eventSlug: string
  project: GalleryProjectCard
}) {
  const winner = project.awards.length > 0
  return (
    <li className="flex">
      <Link
        href={`/${eventSlug}/${project.id}`}
        className={cn(
          "ink hatch group flex w-full flex-col gap-3 rounded px-6 pt-6 pb-7 no-underline transition-transform [--fill:var(--color-card)] hover:-translate-y-1",
          winner && "[--fill:#33245c]"
        )}
      >
        <AwardBadges awards={project.awards} />
        <h3 className="group-hover:text-cream text-[22px] font-bold break-words">
          {project.name}
        </h3>
        {project.summary && (
          <p className="text-base text-muted">{project.summary}</p>
        )}
        <TrackChips tracks={project.tracks} className="mt-auto pt-2" />
      </Link>
    </li>
  )
}
