import { formatInZone } from "@workspace/forms"

import { projectPhase, type ProjectEvent } from "@/lib/projects"

export function ProjectAvailability({ event }: { event: ProjectEvent }) {
  const phase = projectPhase(event)
  let message: string
  if (phase === "scheduled")
    message = `Project submissions open ${formatInZone(event.project_submissions_open_at!)}. For now, you can set up collaborators only.`
  else if (phase === "open")
    message = event.project_submissions_close_at
      ? `Project submissions close ${formatInZone(event.project_submissions_close_at)}.`
      : "Project submissions are open. No scheduled closing yet."
  else if (phase === "disabled")
    message =
      "Project submissions are disabled. Existing projects are read-only."
  else
    message =
      phase === "judging"
        ? "Judging has started. Project content, collaborators, and tracks are read-only."
        : "Project submissions have closed. Existing projects are read-only."
  return (
    <p className="text-sm text-[#6E6E68]">
      {message} Times are in America/New_York.
    </p>
  )
}
