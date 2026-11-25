import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { TableCard } from "@/components/table-card"
import {
  formatResultAverage,
  resultsHref,
  type JudgingResults,
  type ResultsFilters,
} from "@/lib/judging-results"
import { projectHref } from "@/lib/organizer-projects"

export function ResultsSection({
  eventSlug,
  tracks,
  filters,
  data,
  invalidContext = false,
  projectsPage,
}: {
  eventSlug: string
  tracks: { id: string; name: string; active: boolean }[]
  filters: ResultsFilters
  data: JudgingResults | null
  invalidContext?: boolean
  projectsPage: number
}) {
  return (
    <section
      id="results"
      aria-labelledby="results-heading"
      className="flex scroll-mt-6 flex-col gap-4"
    >
      <h2 id="results-heading" className="text-xl font-semibold">
        Results
      </h2>
      <p className="text-sm text-muted-foreground">
        Only submitted, non-cancelled reviews of submitted projects count.
        Completed reviews / target is separate from assigned-slot coverage.
        Insufficient coverage means a project still needs completed reviews;
        these averages are not final. Winner decisions are manual.
      </p>
      <form
        action="/judging#results"
        className="flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="event" value={eventSlug} />
        <input type="hidden" name="projectsPage" value={projectsPage} />
        <label className="flex flex-col gap-1 text-sm">
          Results context
          <select
            name="resultsTrack"
            defaultValue={
              invalidContext ? "unavailable" : (filters.trackId ?? "general")
            }
            className="h-9 rounded-md border bg-background px-2"
          >
            {invalidContext && (
              <option value="unavailable" disabled>
                Unavailable context
              </option>
            )}
            <option value="general">General</option>
            {tracks
              .filter((track) => track.active)
              .map((track) => (
                <option key={track.id} value={track.id}>
                  Sponsor: {track.name}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md border px-3 text-sm">
          Show results
        </button>
      </form>
      {invalidContext ? (
        <p role="alert" className="text-sm">
          Results context unavailable. Choose General or an active sponsor track
          for this event.
        </p>
      ) : (
        data && (
          <>
            <h3 className="font-semibold">
              {data.track_name === null
                ? "General results"
                : `Sponsor: ${data.track_name}`}
            </h3>
            <p className="text-sm text-muted-foreground">
              Each judge&apos;s score is the average of their criterion scores;
              a project&apos;s average is the mean of its judges&apos; scores.
              Highest average first; averages display two decimals. Tie flags
              use unrounded averages across the entire context, including other
              pages. Row order within a tie is for display only, not a
              tie-break.
            </p>
            {data.target === null ? (
              <p className="text-sm">
                Save event settings before viewing results.
              </p>
            ) : data.projects.length === 0 ? (
              <p className="text-sm">
                {filters.page === 1
                  ? "No submitted projects in this results context yet."
                  : "No results on this page."}
              </p>
            ) : (
              <TableCard>
                <Table aria-label="Judging results">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Completed reviews / target</TableHead>
                      <TableHead>Average score / 5</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.projects.map((project) => (
                      <TableRow key={project.project_id}>
                        <TableCell className="break-words whitespace-normal">
                          <Link
                            className="underline"
                            href={projectHref(eventSlug, project.project_id, {
                              status: null,
                              page: projectsPage,
                            })}
                          >
                            {project.project_name.trim() || "Untitled project"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {project.completed} / {data.target}
                          {project.completed > data.target! && (
                            <p className="text-xs">Exceeds current target</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatResultAverage(project.average_score)}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {project.insufficient_coverage && (
                            <p>Insufficient coverage</p>
                          )}
                          {project.tied && <p>Tied average</p>}
                          {!project.insufficient_coverage &&
                            !project.tied &&
                            "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            )}
            {data.target !== null && (
              <nav
                aria-label="Results pages"
                className="flex flex-wrap gap-4 text-sm"
              >
                {filters.page > 1 && (
                  <>
                    <Link
                      className="underline"
                      href={resultsHref(
                        eventSlug,
                        { ...filters, page: 1 },
                        { projectsPage: String(projectsPage) }
                      )}
                    >
                      First page
                    </Link>
                    <Link
                      className="underline"
                      href={resultsHref(
                        eventSlug,
                        { ...filters, page: filters.page - 1 },
                        { projectsPage: String(projectsPage) }
                      )}
                    >
                      Previous
                    </Link>
                  </>
                )}
                <span>Page {filters.page}</span>
                {data.has_more && (
                  <Link
                    className="underline"
                    href={resultsHref(
                      eventSlug,
                      { ...filters, page: filters.page + 1 },
                      { projectsPage: String(projectsPage) }
                    )}
                  >
                    Next
                  </Link>
                )}
              </nav>
            )}
          </>
        )
      )}
    </section>
  )
}
