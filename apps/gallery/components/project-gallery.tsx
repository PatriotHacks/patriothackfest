"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

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
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">
          Search projects
          <input
            type="search"
            value={filters.query}
            disabled={disabled}
            onChange={(event) => set({ query: event.target.value })}
            placeholder="Project name"
            className="border-ink bg-text text-ink placeholder:text-ink/50 focus:outline-blue w-full max-w-md rounded-lg border-2 px-3.5 py-3 text-base focus:outline-3 focus:outline-offset-1"
          />
        </label>
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

      <p aria-live="polite" className="mt-8 mb-6 text-[15px] text-muted">
        {shown.length === projects.length
          ? `${projects.length} ${projects.length === 1 ? "project" : "projects"}`
          : `Showing ${shown.length} of ${projects.length} projects`}
      </p>

      {shown.length > 0 ? (
        <ul className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((project) => (
            <ProjectCard
              key={project.id}
              eventSlug={eventSlug}
              project={project}
            />
          ))}
        </ul>
      ) : (
        <div className="ink ink--dash flex flex-col items-start gap-4 px-6 py-8 [--fill:rgba(184,174,242,0.05)]">
          <p className="text-muted">No projects match these filters.</p>
          <button
            type="button"
            className="btn cursor-pointer"
            onClick={() => onChange?.(NO_FILTERS)}
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  )
}

function Chip({
  pressed,
  winner,
  ...props
}: React.ComponentProps<"button"> & { pressed: boolean; winner?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "cursor-pointer rounded-full border-2 px-3.5 py-1.5 text-sm leading-none font-medium transition-colors disabled:cursor-default",
        pressed
          ? "border-ink bg-blue text-ink"
          : "border-lav/50 text-lav hover:border-lav hover:text-text",
        winner && pressed && "bg-yellow",
        winner && !pressed && "border-yellow/60 text-yellow"
      )}
      {...props}
    />
  )
}
