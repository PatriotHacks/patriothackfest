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
import { AssignmentControls, ManualAssignmentForm } from "./assignment-controls"

export function AssignmentPages({
  eventSlug,
  filters,
  projectsPage,
  kind,
  hasMore,
  resultsQuery = {},
}: {
  eventSlug: string
  filters: AssignmentFilters
  projectsPage: number
  kind: "coveragePage" | "assignmentPage"
  hasMore: boolean
  resultsQuery?: Record<string, string>
}) {
  const page = filters[kind]
  return (
    <nav
      aria-label={
        kind === "coveragePage" ? "Coverage pages" : "Assignment pages"
      }
      className="flex flex-wrap gap-4 text-sm"
    >
      {page > 1 && (
        <Link
          className="underline"
          href={assignmentHref(
            eventSlug,
            { ...filters, [kind]: page - 1 },
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
            { ...filters, [kind]: page + 1 },
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
  filters,
  projectsPage,
  resultsQuery = {},
}: {
  eventId: string
  eventSlug: string
  started: boolean
  data: AssignmentOverview
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
        coverage. Increase capacity or manually manage untouched work if slots
        remain missing.
      </p>
      <GenerateAssignments eventId={eventId} started={started} />
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
                assignmentPage: 1,
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
                          assignmentPage: 1,
                        },
                        projectsPage,
                        resultsQuery
                      )}
                    >
                      Filter assignments to this project
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
        kind="coveragePage"
        hasMore={data.coverage_has_more}
        resultsQuery={resultsQuery}
      />
      <h3 className="font-semibold">Judge loads</h3>
      {data.judges.length === 0 ? (
        <p className="text-sm">No judges configured for this event.</p>
      ) : (
        <TableCard>
          <Table aria-label="Judge assignment loads">
            <TableHeader>
              <TableRow>
                <TableHead>Judge</TableHead>
                <TableHead>Assigned / capacity</TableHead>
                <TableHead>Unfinished</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.judges.map((judge) => (
                <TableRow key={judge.id}>
                  <TableCell className="break-words whitespace-normal">
                    {judge.email}
                    {!judge.active && (
                      <p>
                        Inactive
                        {judge.unfinished > 0 &&
                          " — unfinished assignments need organizer attention"}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {judge.workload} / {judge.capacity}
                    {judge.workload > judge.capacity && (
                      <p className="text-xs">
                        Existing work exceeds current capacity
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{judge.unfinished}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      <h3 className="font-semibold">Manage assignments</h3>
      <p className="text-sm text-muted-foreground">
        Only untouched reviews (no scores, saved notes, or submission) can be
        cancelled or reassigned. Cancellation creates no replacement by itself.
        Generate missing work or assign another eligible judge manually when
        ready.
      </p>
      <form
        action="/judging#assignments"
        className="flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="event" value={eventSlug} />
        <input type="hidden" name="projectsPage" value={projectsPage} />
        <input type="hidden" name="coveragePage" value={filters.coveragePage} />
        {Object.entries(resultsQuery).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {filters.projectId && (
          <input
            type="hidden"
            name="assignmentProject"
            value={filters.projectId}
          />
        )}
        <label className="flex flex-col gap-1 text-sm">
          Review status
          <select
            name="assignmentStatus"
            defaultValue={filters.status}
            className="h-9 rounded-md border bg-background px-2"
          >
            <option value="all">All assignments</option>
            <option value="untouched">Untouched</option>
            <option value="in_progress">In progress (protected)</option>
            <option value="submitted">Submitted (protected)</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md border px-3 text-sm">
          Filter
        </button>
      </form>
      {data.assignments.length === 0 ? (
        <p className="text-sm">No assignments match this page and filter.</p>
      ) : (
        <TableCard>
          <Table aria-label="Manage judging assignments">
            <TableHeader>
              <TableRow>
                <TableHead>Project / context</TableHead>
                <TableHead>Judge / status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="whitespace-normal">
                    <Link
                      className="underline"
                      href={projectHref(eventSlug, assignment.project_id, {
                        status: null,
                        page: projectsPage,
                      })}
                    >
                      {assignment.project_name}
                    </Link>
                    <p>{assignmentContextLabel(assignment.track_name)}</p>
                  </TableCell>
                  <TableCell className="break-words whitespace-normal">
                    {assignment.judge_email}
                    <p>
                      {assignment.status === "in_progress"
                        ? "In progress"
                        : assignment.status === "untouched"
                          ? "Untouched"
                          : assignment.status === "submitted"
                            ? "Submitted"
                            : "Cancelled"}
                    </p>
                    {!assignment.judge_active && <p>Inactive judge</p>}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <AssignmentControls
                      eventId={eventId}
                      assignment={assignment}
                      started={started}
                    />
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
        kind="assignmentPage"
        hasMore={data.assignments_has_more}
        resultsQuery={resultsQuery}
      />
    </section>
  )
}
