import { formatInZone } from "@workspace/forms"
import { Pill } from "@workspace/ui/components/pill"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { TableCard } from "@/components/table-card"
import {
  PROJECT_STATUS_LABELS,
  projectHref,
  projectPersonLabel,
  projectsHref,
  type EventProjects,
  type ProjectStatus,
  type ProjectsQuery,
} from "@/lib/organizer-projects"

const STATUS_TONES = {
  draft: "amber",
  submitted: "olive",
  withdrawn: "muted",
} as const

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Pill tone={STATUS_TONES[status]} size="sm">
      {PROJECT_STATUS_LABELS[status]}
    </Pill>
  )
}

function ProjectStatusFilter({
  eventSlug,
  selected,
  counts,
}: {
  eventSlug: string
  selected: ProjectStatus | null
  counts: EventProjects["counts"]
}) {
  const options: { status: ProjectStatus | null; count: number }[] = [
    {
      status: null,
      count: counts.draft + counts.submitted + counts.withdrawn,
    },
    { status: "draft", count: counts.draft },
    { status: "submitted", count: counts.submitted },
  ]
  if (counts.withdrawn > 0 || selected === "withdrawn")
    options.push({ status: "withdrawn", count: counts.withdrawn })
  return (
    <nav
      aria-label="Project status"
      className="flex gap-1 border-b border-border text-[15px]"
    >
      {options.map(({ status, count }) => {
        const active = status === selected
        return (
          <Link
            key={status ?? "all"}
            href={projectsHref(eventSlug, { status, page: 1 })}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2 font-medium text-muted-foreground transition-colors hover:text-foreground",
              active && "border-primary text-foreground"
            )}
          >
            {status ? PROJECT_STATUS_LABELS[status] : "All"}
            <span className="rounded-full bg-muted px-2 text-[12px] text-muted-foreground tabular-nums">
              {count}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

export function ProjectsList({
  eventSlug,
  query,
  data,
}: {
  eventSlug: string
  query: ProjectsQuery
  data: EventProjects
}) {
  const { page } = query
  return (
    <section className="flex flex-col gap-4" aria-label="Projects">
      <ProjectStatusFilter
        eventSlug={eventSlug}
        selected={query.status}
        counts={data.counts}
      />
      {data.projects.length === 0 ? (
        <p className="text-sm">
          {page === 1
            ? "No projects match this filter yet."
            : "No projects on this page."}
        </p>
      ) : (
        <TableCard>
          <Table aria-label="Projects">
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead>Required answers</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.projects.map((project) => {
                const name = project.name.trim() || "Untitled project"
                const submittedAt =
                  project.status === "submitted" ? project.submitted_at : null
                const at = submittedAt ?? project.updated_at
                return (
                  <TableRow key={project.id}>
                    <TableCell className="max-w-64 font-medium break-words whitespace-normal">
                      {name}
                    </TableCell>
                    <TableCell>
                      <ProjectStatusBadge status={project.status} />
                    </TableCell>
                    <TableCell className="max-w-48 break-words whitespace-normal">
                      {projectPersonLabel(project.owner)}
                    </TableCell>
                    <TableCell>
                      {submittedAt ? "Submitted " : "Updated "}
                      <time dateTime={at}>{formatInZone(at)}</time>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {data.required_count === 0
                        ? "None required"
                        : `${project.answered_count} / ${data.required_count} required`}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={projectHref(eventSlug, project.id, query)}
                        className="underline"
                        aria-label={`View ${name}`}
                      >
                        View project
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}
      <nav
        aria-label="Project pages"
        className="flex flex-wrap items-center gap-4 text-sm"
      >
        {page > 1 && (
          <>
            <Link
              href={projectsHref(eventSlug, { ...query, page: 1 })}
              className="underline"
            >
              First page
            </Link>
            <Link
              href={projectsHref(eventSlug, { ...query, page: page - 1 })}
              className="underline"
            >
              Previous
            </Link>
          </>
        )}
        <span>Page {page}</span>
        {data.has_more && (
          <Link
            href={projectsHref(eventSlug, { ...query, page: page + 1 })}
            className="underline"
          >
            Next
          </Link>
        )}
      </nav>
    </section>
  )
}
