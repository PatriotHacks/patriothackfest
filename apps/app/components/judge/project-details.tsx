import { PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import { reviewContext, type JudgeAssignment } from "@/lib/judge-reviews"
import { memberName } from "@/lib/projects"
import { JudgeAnswers } from "./answers"
import { OrganizerContact } from "./queue"

export function JudgeProjectDetails({ detail }: { detail: JudgeAssignment }) {
  return (
    <article className={cn(PAPER, "flex flex-col gap-4 p-6")}>
      <p className="font-semibold">{reviewContext(detail.assignment)}</p>
      <p className="text-sm">
        Read-only submitted project. This scorecard applies only to the context
        above.
      </p>
      {detail.team.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Team</h2>
          <ul className="list-inside list-disc">
            {detail.team.map((name, index) => (
              <li key={index}>{memberName(name)}</li>
            ))}
          </ul>
        </>
      )}
      <JudgeAnswers answers={detail.answers} />
      <OrganizerContact />
    </article>
  )
}
