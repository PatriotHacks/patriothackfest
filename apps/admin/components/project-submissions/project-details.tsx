import { formatInZone } from "@workspace/forms"
import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { ProjectAnswers } from "@/components/project-submissions/project-answers"
import { ProjectStatusBadge } from "@/components/project-submissions/projects-list"
import {
  projectPersonLabel,
  projectsHref,
  type ProjectDetail,
  type ProjectsQuery,
  type ProjectTrack,
} from "@/lib/organizer-projects"

const STATUS_NOTES = {
  draft:
    "Read-only organizer view of a draft. Participants can keep editing until they submit.",
  submitted:
    "Read-only organizer view of current submitted content. Participants may still save changes until submissions close.",
  withdrawn:
    "Read-only organizer view of a withdrawn project. It is not judged.",
} as const

function ProjectTrackLabels({ tracks }: { tracks: ProjectTrack[] }) {
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

export function ProjectDetails({
  event,
  detail,
  query,
}: {
  event: { name: string; slug: string }
  detail: ProjectDetail
  query: ProjectsQuery
}) {
  const project = detail.project
  const submittedAt =
    project.status === "submitted" ? project.submitted_at : null
  return (
    <div className="flex max-w-4xl flex-col gap-5 text-[#3A4A2B]">
      <Link
        href={projectsHref(event.slug, query)}
        className="text-sm underline"
      >
        Back to project submissions
      </Link>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{event.name}</span>
        <ProjectStatusBadge status={project.status} />
      </div>
      <h1 className={cn(SERIF, "text-4xl break-words")}>
        {project.name.trim() || "Untitled project"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {STATUS_NOTES[project.status]} Viewing this page does not change or lock
        the project.
      </p>
      <article className={cn(PAPER, "flex flex-col gap-5 p-6")}>
        {detail.answers.length > 0 && (
          <section
            aria-label="Question answers"
            className="flex flex-col gap-3"
          >
            <ProjectAnswers answers={detail.answers} />
          </section>
        )}
        <section
          aria-label="Project participants"
          className="flex flex-col gap-2"
        >
          <h2 className="text-xl font-semibold">Owner</h2>
          <p>{projectPersonLabel(detail.owner)}</p>
          <h2 className="text-xl font-semibold">Collaborators</h2>
          {detail.collaborators.length === 0 ? (
            <p>No additional collaborators.</p>
          ) : (
            <ul className="list-inside list-disc">
              {detail.collaborators.map((person) => (
                <li key={person.id}>{projectPersonLabel(person)}</li>
              ))}
            </ul>
          )}
        </section>
        <section
          className="flex flex-col gap-2"
          aria-label="Selected sponsor tracks"
        >
          <h2 className="text-xl font-semibold">Sponsor tracks</h2>
          <ProjectTrackLabels tracks={detail.tracks} />
          <p className="text-sm">
            All submitted projects enter general judging.
          </p>
        </section>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {submittedAt && (
            <div>
              <dt className="font-semibold">Submitted</dt>
              <dd>
                <time dateTime={submittedAt}>{formatInZone(submittedAt)}</time>
              </dd>
            </div>
          )}
          <div>
            <dt className="font-semibold">Last updated</dt>
            <dd>
              <time dateTime={project.updated_at}>
                {formatInZone(project.updated_at)}
              </time>
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          Times are in America/New_York. No admissions answers, contact details,
          or scores are included in this view.
        </p>
      </article>
    </div>
  )
}
