import { formatInZone } from "@workspace/forms"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import Link from "next/link"

import { TableCard } from "@/components/table-card"
import {
  projectPersonLabel,
  submittedProjectHref,
  submittedProjectsHref,
  type SubmittedProjects,
} from "@/lib/organizer-projects"

export function ProjectTrackLabels({
  tracks,
}: {
  tracks: SubmittedProjects["projects"][number]["tracks"]
}) {
  return tracks.length === 0 ? (
    <span>None (general judging only)</span>
  ) : (
    <ul className="flex flex-col gap-1">
      {tracks.map((track) => (
        <li key={track.id}>
          {track.name}
          {!track.active && " (inactive)"}
        </li>
      ))}
    </ul>
  )
}

export function SubmittedProjectsList({
  eventSlug,
  page,
  data,
  judgingQuery = {},
}: {
  eventSlug: string
  page: number
  data: SubmittedProjects
  judgingQuery?: Record<string, string>
}) {
  return (
    <section
      id="submitted-projects"
      className="flex scroll-mt-6 flex-col gap-4"
      aria-labelledby="submitted-projects-heading"
    >
      <h2 id="submitted-projects-heading" className="text-xl font-semibold">
        Submitted projects
      </h2>
      <p className="text-sm text-muted-foreground">
        Read-only submissions for this event. Drafts and withdrawn projects are
        excluded. Submission times are in America/New_York.
      </p>
      {data.projects.length === 0 ? (
        <p className="text-sm">
          {page === 1
            ? "No submitted projects for this event yet."
            : "No submitted projects on this page."}
        </p>
      ) : (
        <TableCard>
          <Table aria-label="Submitted projects">
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Sponsor tracks</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.projects.map((project) => {
                const name = project.name.trim() || "Untitled project"
                return (
                  <TableRow key={project.id}>
                    <TableCell className="max-w-64 font-medium break-words whitespace-normal">
                      {name}
                    </TableCell>
                    <TableCell className="max-w-48 break-words whitespace-normal">
                      {projectPersonLabel(project.owner)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <ProjectTrackLabels tracks={project.tracks} />
                    </TableCell>
                    <TableCell>
                      <time dateTime={project.submitted_at}>
                        {formatInZone(project.submitted_at)}
                      </time>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={submittedProjectHref(eventSlug, project.id, page)}
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
        aria-label="Submitted project pages"
        className="flex flex-wrap items-center gap-4 text-sm"
      >
        {page > 1 && (
          <>
            <Link
              href={submittedProjectsHref(eventSlug, 1, judgingQuery)}
              className="underline"
            >
              First page
            </Link>
            <Link
              href={submittedProjectsHref(eventSlug, page - 1, judgingQuery)}
              className="underline"
            >
              Previous
            </Link>
          </>
        )}
        <span>Page {page}</span>
        {data.has_more && (
          <Link
            href={submittedProjectsHref(eventSlug, page + 1, judgingQuery)}
            className="underline"
          >
            Next
          </Link>
        )}
      </nav>
    </section>
  )
}
