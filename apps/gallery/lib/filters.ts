export type GalleryFilters = {
  query: string
  track: string | null
  winners: boolean
}

type Filterable = {
  name: string
  tracks: { id: string }[]
  awards: unknown[]
}

export function parseFilters(params: URLSearchParams): GalleryFilters {
  return {
    query: params.get("q") ?? "",
    track: params.get("track"),
    winners: params.get("winners") === "1",
  }
}

export function filtersSearch(filters: GalleryFilters) {
  const params = new URLSearchParams()
  const query = filters.query.trim()
  if (query) params.set("q", query)
  if (filters.track) params.set("track", filters.track)
  if (filters.winners) params.set("winners", "1")
  const search = params.toString()
  return search ? `?${search}` : ""
}

export function filterProjects<T extends Filterable>(
  projects: T[],
  filters: GalleryFilters
) {
  const query = filters.query.trim().toLocaleLowerCase()
  return projects.filter(
    (project) =>
      (!query || project.name.toLocaleLowerCase().includes(query)) &&
      (!filters.track ||
        project.tracks.some((track) => track.id === filters.track)) &&
      (!filters.winners || project.awards.length > 0)
  )
}
