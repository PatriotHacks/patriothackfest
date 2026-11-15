"use client"

import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { useId, useRef, useState, useTransition } from "react"
import {
  addAssignment,
  cancelAssignment,
  getAssignmentCandidates,
  reassignAssignment,
} from "@/app/(admin)/judging/assignments-actions"
import type { AssignmentCandidate, AssignmentOverview } from "@/lib/assignments"

export function ManualAssignmentForm({
  eventId,
  projectId,
  trackId,
  assignmentId,
}: {
  eventId: string
  projectId: string
  trackId: string | null
  assignmentId?: string
}) {
  const id = useId()
  const [candidates, setCandidates] = useState<AssignmentCandidate[] | null>(
    null
  )
  const [judgeId, setJudgeId] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const busy = useRef(false)

  function run(task: () => Promise<void>) {
    if (busy.current) return
    busy.current = true
    setMessage(null)
    startTransition(async () => {
      try {
        await task()
      } catch {
        setMessage("Could not update assignments. Refresh and try again.")
      } finally {
        busy.current = false
      }
    })
  }
  return (
    <form
      className="flex min-w-48 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!judgeId || busy.current) return
        if (
          assignmentId &&
          !window.confirm(
            "Reassign this untouched review? The old assignment stays cancelled and will not be regenerated for its original judge."
          )
        )
          return
        run(async () => {
          const result = assignmentId
            ? await reassignAssignment({ eventId, assignmentId, judgeId })
            : await addAssignment({ eventId, projectId, trackId, judgeId })
          setMessage(
            result.error ??
              (assignmentId ? "Assignment reassigned" : "Assignment added")
          )
          if (!result.error) {
            setCandidates(null)
            setJudgeId("")
          }
        })
      }}
    >
      <fieldset disabled={pending} className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            run(async () => {
              const result = await getAssignmentCandidates({
                eventId,
                projectId,
                trackId,
              })
              if (result.error) {
                setMessage(result.error)
                return
              }
              const next = result.candidates ?? []
              setCandidates(next)
              setJudgeId(
                next.some((c) => c.judge_id === judgeId)
                  ? judgeId
                  : (next[0]?.judge_id ?? "")
              )
            })
          }
        >
          {pending
            ? "Working…"
            : candidates === null
              ? assignmentId
                ? "Choose replacement judge"
                : "Assign manually"
              : "Refresh eligible judges"}
        </Button>
        {candidates !== null &&
          (candidates.length === 0 ? (
            <p className="text-xs">
              No eligible judges with remaining capacity. Increase capacity or
              add eligible judges. Cancelled pairs cannot be reused.
            </p>
          ) : (
            <>
              <Label htmlFor={id}>Eligible judge</Label>
              <select
                id={id}
                className="h-9 max-w-72 rounded-md border bg-background px-2 text-sm"
                value={judgeId}
                onChange={(event) => setJudgeId(event.target.value)}
                required
              >
                {candidates.map((judge) => (
                  <option key={judge.judge_id} value={judge.judge_id}>
                    {judge.email} ({judge.workload}/{judge.capacity})
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={!judgeId}
              >
                {assignmentId ? "Reassign untouched review" : "Add assignment"}
              </Button>
            </>
          ))}
      </fieldset>
      <p role="status" aria-live="polite" className="text-xs">
        {message}
      </p>
    </form>
  )
}

export function CancelAssignmentButton({
  eventId,
  assignmentId,
}: {
  eventId: string
  assignmentId: string
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const busy = useRef(false)
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            busy.current ||
            !window.confirm(
              "Cancel this untouched assignment? No replacement is created now. Later generation may assign another eligible judge, but will never recreate this cancelled judge/project/context pair."
            )
          )
            return
          busy.current = true
          setMessage(null)
          startTransition(async () => {
            try {
              const result = await cancelAssignment({ eventId, assignmentId })
              setMessage(
                result.error ?? "Assignment cancelled; no replacement created"
              )
            } catch {
              setMessage("Could not cancel assignment. Refresh and try again.")
            } finally {
              busy.current = false
            }
          })
        }}
      >
        {pending ? "Cancelling…" : "Cancel untouched assignment"}
      </Button>
      <p role="status" aria-live="polite" className="text-xs">
        {message}
      </p>
    </div>
  )
}

export function AssignmentControls({
  eventId,
  assignment,
  started,
}: {
  eventId: string
  assignment: AssignmentOverview["assignments"][number]
  started: boolean
}) {
  if (assignment.status === "cancelled")
    return (
      <p className="text-xs">
        Cancelled pair retained; never regenerated for this judge.
      </p>
    )
  if (assignment.status !== "untouched")
    return (
      <p className="text-xs">
        Protected review: scores, notes, or a submission exist. Cannot cancel or
        reassign.
      </p>
    )
  if (!started)
    return <p className="text-xs">Start judging before managing assignments.</p>
  return (
    <div className="flex flex-col gap-2">
      <ManualAssignmentForm
        eventId={eventId}
        assignmentId={assignment.id}
        projectId={assignment.project_id}
        trackId={assignment.track_id}
      />
      <CancelAssignmentButton eventId={eventId} assignmentId={assignment.id} />
    </div>
  )
}
