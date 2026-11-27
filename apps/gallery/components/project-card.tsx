import Link from "next/link"

import { PAPER } from "@workspace/ui/lib/brand"
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
          PAPER,
          "group flex w-full flex-col gap-3 p-6 transition-colors hover:border-[#3A4A2B]/40",
          winner && "border-[#E3CB8C] bg-[#FDF3DC] hover:border-[#7A5A14]/50"
        )}
      >
        <AwardBadges awards={project.awards} />
        <h3 className="text-xl font-semibold break-words underline-offset-2 group-hover:underline">
          {project.name}
        </h3>
        {project.summary && (
          <p className="text-[14.5px] text-[#6E6E68]">{project.summary}</p>
        )}
        <TrackChips tracks={project.tracks} className="mt-auto pt-1" />
      </Link>
    </li>
  )
}
