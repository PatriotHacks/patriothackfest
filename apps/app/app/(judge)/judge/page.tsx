import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { getJudgeEvents } from "@/lib/judge-access"

export default async function JudgeEventsPage() {
  const events = await getJudgeEvents()
  return (
    <>
      <h1 className={cn(SERIF, "text-4xl")}>Your judging events</h1>
      {events.length === 0 ? (
        <section className={cn(PAPER, "flex flex-col gap-3 p-6")}>
          <h2 className="text-xl font-semibold">Judge access not configured</h2>
          <p>
            No active judge roster matches your verified signed-in account. Ask
            an organizer to check the email and active status. You do not need
            to submit a participant application.
          </p>
        </section>
      ) : (
        events.map((event) => (
          <Link
            key={event.event_id}
            href={`/judge/${encodeURIComponent(event.slug)}`}
            className={cn(PAPER, "flex flex-col gap-2 p-6 hover:underline")}
          >
            <h2 className="text-xl font-semibold">{event.name}</h2>
            <p>
              {event.kind === "general" ? "General judge" : "Sponsor judge"}
            </p>
          </Link>
        ))
      )}
      <p className="text-sm text-[#6E6E68]">
        Choose an event to view your assigned review queue and scorecards.
        Only your own assigned projects and reviews are available here.
      </p>
    </>
  )
}
