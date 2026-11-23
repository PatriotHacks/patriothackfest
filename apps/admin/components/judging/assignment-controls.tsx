"use client"

import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { useId, useRef, useState, useTransition } from "react"
import {
  addAssignment,
  getAssignmentCandidates,
} from "@/app/(admin)/judging/assignments-actions"
import type { AssignmentCandidate } from "@/lib/assignments"

export function ManualAssignmentForm({
  eventId,
  projectId,
  trackId,
}: {
  eventId: string
  projectId: string
  trackId: string | null
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
        run(async () => {
          const result = await addAssignment({
            eventId,
            projectId,
            trackId,
            judgeId,
          })
          setMessage(result.error ?? "Assignment added")
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
              ? "Assign manually"
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
                Add assignment
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
