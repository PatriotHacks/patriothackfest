import { formatInZone } from "@workspace/forms"
import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { ProjectAnswers } from "@/components/judging/project-answers"
import { ProjectTrackLabels } from "@/components/judging/projects"
import {
  projectPersonLabel,
  submittedProjectsHref,
  type SubmittedProjectDetail,
} from "@/lib/organizer-projects"

export function SubmittedProjectDetails({
  event,
  detail,
  page,
}: {
  event: { name: string; slug: string }
  detail: SubmittedProjectDetail
  page: number
}) {
  const project = detail.project
  return (
    <div className="flex max-w-4xl flex-col gap-5 text-[#3A4A2B]">
      <Link
        href={submittedProjectsHref(event.slug, page)}
        className="text-sm underline"
      >
        Back to submitted projects
      </Link>
      <p className="text-sm text-muted-foreground">
        {event.name} · Submitted project
      </p>
      <h1 className={cn(SERIF, "text-4xl break-words")}>
        {project.name.trim() || "Untitled project"}
      </h1>
      <p className="text-sm text-muted-foreground">
        Read-only organizer view of current submitted content. Participants may
        still save changes until submissions close. Viewing this page does not
        change or lock the project.
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
          <div>
            <dt className="font-semibold">Submitted</dt>
            <dd>
              <time dateTime={project.submitted_at}>
                {formatInZone(project.submitted_at)}
              </time>
            </dd>
          </div>
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
