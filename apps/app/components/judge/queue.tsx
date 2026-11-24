import { Button } from "@workspace/ui/components/button"
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
  briefingHref,
}: {
  eventSlug: string
  queue: JudgeQueue
  startHref: string | null
  briefingHref: string | null
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
      {briefingHref ? (
        <div className="flex flex-col gap-2 rounded-sm border border-[#E7E4D9] p-4">
          <h3 className="font-semibold">
            Read the briefing to unlock your projects
          </h3>
          <p className="text-sm">
            Your assigned projects open after you read the build scenario and
            confirm you have read it.
          </p>
          <Button asChild className="w-fit">
            <Link href={briefingHref}>Read the briefing</Link>
          </Button>
        </div>
      ) : (
        unfinished &&
        startHref && (
          <Link
            className={cn(OUTLINE_PILL, "inline-flex items-center")}
            href={startHref}
          >
            {queue.completed > 0 ? "Continue judging" : "Start judging"}
          </Link>
        )
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
                  href={
                    briefingHref ??
                    judgeAssignmentHref(eventSlug, assignment.id)
                  }
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
