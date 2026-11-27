"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

import { AuthInput, AuthLabel } from "@workspace/ui/components/auth-fields"
import { Button } from "@workspace/ui/components/button"
import { pillVariants } from "@workspace/ui/components/pill"
import { OUTLINE_PILL, PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import {
  filterProjects,
  filtersSearch,
  parseFilters,
  type GalleryFilters,
} from "@/lib/filters"
import type { GalleryProjectCard, GalleryTrack } from "@/lib/gallery"
import { ProjectCard } from "./project-card"

type GalleryProps = {
  eventSlug: string
  tracks: GalleryTrack[]
  hasWinners: boolean
  projects: GalleryProjectCard[]
}

const NO_FILTERS: GalleryFilters = { query: "", track: null, winners: false }

export function ProjectGallery(props: GalleryProps) {
  return (
    <Suspense fallback={<GalleryView {...props} filters={NO_FILTERS} />}>
      <UrlGallery {...props} />
    </Suspense>
  )
}

function UrlGallery(props: GalleryProps) {
  const params = useSearchParams()
  const [filters, setFilters] = useState(() => parseFilters(params))

  function update(next: GalleryFilters) {
    setFilters(next)
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${filtersSearch(next)}`
    )
  }

  return <GalleryView {...props} filters={filters} onChange={update} />
}

function GalleryView({
  eventSlug,
  tracks,
  hasWinners,
  projects,
  filters,
  onChange,
}: GalleryProps & {
  filters: GalleryFilters
  onChange?: (filters: GalleryFilters) => void
}) {
  const shown = filterProjects(projects, filters)
  const disabled = !onChange
  const set = (patch: Partial<GalleryFilters>) =>
    onChange?.({ ...filters, ...patch })

  return (
    <>
      <search className="flex flex-col gap-4">
        <div className="flex max-w-md flex-col gap-[6.5px]">
          <AuthLabel htmlFor="gallery-search">Search projects</AuthLabel>
          <AuthInput
            id="gallery-search"
            type="search"
            value={filters.query}
            disabled={disabled}
            onChange={(event) => set({ query: event.target.value })}
            placeholder="Project name"
            className="h-11"
          />
        </div>
        {(tracks.length > 0 || hasWinners) && (
          <div
            role="group"
            aria-label="Filter projects"
            className="flex flex-wrap gap-2"
          >
            {hasWinners && (
              <Chip
                pressed={filters.winners}
                disabled={disabled}
                onClick={() => set({ winners: !filters.winners })}
                winner
              >
                Winners
              </Chip>
            )}
            {tracks.map((track) => (
              <Chip
                key={track.id}
                pressed={filters.track === track.id}
                disabled={disabled}
                onClick={() =>
                  set({ track: filters.track === track.id ? null : track.id })
                }
              >
                {track.name}
                {track.sponsor && (
                  <span className="font-normal opacity-75">
                    {" "}
                    by {track.sponsor}
                  </span>
                )}
              </Chip>
            ))}
          </div>
        )}
      </search>

      <p aria-live="polite" className="-mb-1 text-sm text-[#6E6E68]">
        {shown.length === projects.length
          ? `${projects.length} ${projects.length === 1 ? "project" : "projects"}`
          : `Showing ${shown.length} of ${projects.length} projects`}
      </p>

      {shown.length > 0 ? (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((project) => (
            <ProjectCard
              key={project.id}
              eventSlug={eventSlug}
              project={project}
            />
          ))}
        </ul>
      ) : (
        <div className={cn(PAPER, "flex flex-col items-start gap-4 p-6")}>
          <p>No projects match these filters.</p>
          <Button
            type="button"
            variant="outline"
            className={OUTLINE_PILL}
            onClick={() => onChange?.(NO_FILTERS)}
          >
            Clear filters
          </Button>
        </div>
      )}
    </>
  )
}

function Chip({
  pressed,
  winner,
  className,
  ...props
}: React.ComponentProps<"button"> & { pressed: boolean; winner?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        pillVariants({
          tone: pressed ? "olive" : winner ? "amber" : "outline",
        }),
        "cursor-pointer py-[6px] transition-colors disabled:cursor-default",
        !pressed && "hover:bg-[#3A4A2B]/5",
        winner && !pressed && "font-semibold hover:bg-[#EFDDB0]",
        className
      )}
      {...props}
    />
  )
}
