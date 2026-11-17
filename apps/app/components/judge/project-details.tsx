import { PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import {
  judgeProjectUrl,
  reviewContext,
  type JudgeAssignment,
} from "@/lib/judge-reviews"
import { JudgeAnswers } from "./answers"
import { OrganizerContact } from "./queue"

export function JudgeProjectDetails({ detail }: { detail: JudgeAssignment }) {
  const project = detail.project
  const links = [
    {
      label: "Repository/source",
      url: judgeProjectUrl(project.repository_url),
    },
    { label: "Demo", url: judgeProjectUrl(project.demo_url) },
    { label: "Video", url: judgeProjectUrl(project.video_url) },
  ]
  return (
    <article className={cn(PAPER, "flex flex-col gap-4 p-6")}>
      <p className="font-semibold">{reviewContext(detail.assignment)}</p>
      <p className="text-sm">
        Read-only submitted project. This scorecard applies only to the context
        above.
      </p>
      <h2 className="text-lg font-semibold">Summary</h2>
      <p className="break-words whitespace-pre-wrap">{project.summary}</p>
      <h2 className="text-lg font-semibold">Description</h2>
      <p className="break-words whitespace-pre-wrap">{project.description}</p>
      <p className="break-words">
        <strong>Technologies:</strong> {project.technologies || "Not provided"}
      </p>
      <JudgeAnswers answers={detail.answers} />
      <ul className="flex flex-wrap gap-4" aria-label="Project links">
        {links.map(
          (link) =>
            link.url && (
              <li key={link.label}>
                <a
                  href={link.url}
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              </li>
            )
        )}
      </ul>
      <OrganizerContact />
    </article>
  )
}
