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
  assignmentContextLabel,
  assignmentHref,
  type AssignmentFilters,
  type AssignmentOverview,
} from "@/lib/assignments"
import { projectHref } from "@/lib/organizer-projects"
import { GenerateAssignments } from "./generate-assignments"
import { RebalanceAssignments } from "./rebalance-assignments"
import { ManualAssignmentForm } from "./assignment-controls"
import { JudgeProgressTable } from "./judge-progress"
import type { JudgeProgress } from "@/lib/judge-progress"

export function AssignmentPages({
  eventSlug,
  filters,
  projectsPage,
  hasMore,
  resultsQuery = {},
}: {
  eventSlug: string
  filters: AssignmentFilters
  projectsPage: number
  hasMore: boolean
  resultsQuery?: Record<string, string>
}) {
  const page = filters.coveragePage
  return (
    <nav aria-label="Coverage pages" className="flex flex-wrap gap-4 text-sm">
      {page > 1 && (
        <Link
          className="underline"
          href={assignmentHref(
            eventSlug,
            { ...filters, coveragePage: page - 1 },
            projectsPage,
            resultsQuery
          )}
        >
          Previous
        </Link>
      )}
      <span>Page {page}</span>
      {hasMore && (
        <Link
          className="underline"
          href={assignmentHref(
            eventSlug,
            { ...filters, coveragePage: page + 1 },
            projectsPage,
            resultsQuery
          )}
        >
          Next
        </Link>
      )}
    </nav>
  )
}

export function AssignmentsSection({
  eventId,
  eventSlug,
  started,
  data,
  progress,
  filters,
  projectsPage,
  resultsQuery = {},
}: {
  eventId: string
  eventSlug: string
  started: boolean
  data: AssignmentOverview
  progress: JudgeProgress[]
  filters: AssignmentFilters
  projectsPage: number
  resultsQuery?: Record<string, string>
}) {
  return (
    <section
      id="assignments"
      aria-labelledby="assignments-heading"
      className="flex scroll-mt-6 flex-col gap-4"
    >
      <h2 id="assignments-heading" className="text-xl font-semibold">
        Assignments
      </h2>
      <p className="text-sm text-muted-foreground">
        Sponsor contexts with the fewest eligible judges are assigned first,
        then general judging. This greedy routine does not guarantee optimal
        coverage. Increase capacity or assign judges manually if slots remain
        missing.
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <GenerateAssignments eventId={eventId} started={started} />
        <RebalanceAssignments eventId={eventId} started={started} />
      </div>
      <p className="font-medium">
        {data.missing} missing review slots across this event
      </p>
      <p className="text-sm text-muted-foreground">
        Coverage counts assigned reviews, not completed reviews. All
        non-cancelled work counts, including completed work and assignments held
        by inactive judges. Existing work is never silently removed when targets
        or capacity decrease.
      </p>
      {filters.projectId && (
        <p className="text-sm">
          Filtered to project {filters.projectId}.{" "}
          <Link
            className="underline"
            href={assignmentHref(
              eventSlug,
              {
                ...filters,
                projectId: undefined,
                coveragePage: 1,
              },
              projectsPage,
              resultsQuery
            )}
          >
            Show all projects
          </Link>
        </p>
      )}
      <h3 className="font-semibold">Project coverage</h3>
      {data.coverage.length === 0 ? (
        <p className="text-sm">No submitted project contexts on this page.</p>
      ) : (
        <TableCard>
          <Table aria-label="Project assignment coverage">
            <TableHeader>
              <TableRow>
                <TableHead>Project / context</TableHead>
                <TableHead>Assigned / target</TableHead>
                <TableHead>Missing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.coverage.map((context) => (
                <TableRow key={`${context.project_id}/${context.track_id}`}>
                  <TableCell className="whitespace-normal">
                    <Link
                      className="underline"
                      href={projectHref(eventSlug, context.project_id, {
                        status: null,
                        page: projectsPage,
                      })}
                    >
                      {context.project_name}
                    </Link>
                    <p>{assignmentContextLabel(context.track_name)}</p>
                    <Link
                      className="text-xs underline"
                      href={assignmentHref(
                        eventSlug,
                        {
                          ...filters,
                          projectId: context.project_id,
                          coveragePage: 1,
                        },
                        projectsPage,
                        resultsQuery
                      )}
                    >
                      Filter coverage to this project
                    </Link>
                  </TableCell>
                  <TableCell>
                    {context.assigned} / {context.target}
                    {context.assigned > context.target && (
                      <p className="text-xs">
                        Existing work exceeds current target
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <p>{context.missing}</p>
                    {started && context.missing > 0 && (
                      <ManualAssignmentForm
                        eventId={eventId}
                        projectId={context.project_id}
                        trackId={context.track_id}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      <AssignmentPages
        eventSlug={eventSlug}
        filters={filters}
        projectsPage={projectsPage}
        hasMore={data.coverage_has_more}
        resultsQuery={resultsQuery}
      />
      <JudgeProgressTable judges={progress} />
    </section>
  )
}
