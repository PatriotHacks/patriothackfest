import { OUTLINE_PILL, PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import {
  judgeAssignmentHref,
  reviewContext,
  type JudgeQueue,
} from "@/lib/judge-reviews"

export function JudgeQueueList({
  eventSlug,
  queue,
  startHref,
}: {
  eventSlug: string
  queue: JudgeQueue
  startHref: string | null
}) {
  const unfinished = queue.completed < queue.total
  return (
    <section
      className={cn(PAPER, "flex flex-col gap-4 p-6")}
      aria-label="Your review queue"
    >
      <h2 className="text-xl font-semibold">Your review queue</h2>
      <p>
        {queue.completed} / {queue.total} reviews completed
      </p>
      {unfinished && startHref && (
        <Link
          className={cn(OUTLINE_PILL, "inline-flex items-center")}
          href={startHref}
        >
          {queue.completed > 0 ? "Continue judging" : "Start judging"}
        </Link>
      )}
      {queue.total === 0 ? (
        <p>
          No reviews assigned yet. Ask an organizer if you expected assignments.
        </p>
      ) : (
        <>
          {!unfinished && <p>All assigned reviews are complete. Thank you!</p>}
          <ul className="flex flex-col gap-3">
            {queue.assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="border-t border-[#E7E4D9] pt-3"
              >
                <Link
                  href={judgeAssignmentHref(eventSlug, assignment.id)}
                  className="font-semibold break-words underline"
                >
                  {assignment.project_name}
                </Link>
                <p className="text-sm">
                  {reviewContext(assignment)} ·{" "}
                  {assignment.submitted_at
                    ? "Submitted"
                    : assignment.in_progress
                      ? "Draft saved"
                      : "Not started"}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
      <OrganizerContact />
    </section>
  )
}

export function OrganizerContact() {
  return (
    <p className="text-sm">
      Conflict or inaccessible demo?{" "}
      <a className="underline" href="mailto:hello@patriothackfest.com">
        Contact an organizer
      </a>{" "}
      before scoring.
    </p>
  )
}
