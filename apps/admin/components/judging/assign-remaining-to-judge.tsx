"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useId, useRef, useState, useTransition } from "react"
import {
  assignRemainingToJudge,
  previewAssignRemainingToJudge,
} from "@/app/(admin)/judging/assignments-actions"
import {
  assignRemainingPreviewMessage,
  assignRemainingResultMessage,
  type AssignRemainingPlan,
} from "@/lib/assignments"
import type { JudgeRosterEntry } from "@/lib/judges"

export function AssignRemainingToJudge({
  eventId,
  started,
  judges,
}: {
  eventId: string
  started: boolean
  judges: JudgeRosterEntry[]
}) {
  const id = useId()
  const eligible = judges.filter((judge) => judge.active && !judge.guest)
  const [open, setOpen] = useState(false)
  const [judgeId, setJudgeId] = useState<string | null>(null)
  const [plan, setPlan] = useState<AssignRemainingPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const selected = useRef<string | null>(null)

  function choose(next: string) {
    selected.current = next
    setJudgeId(next)
    setPlan(null)
    setError(null)
    startTransition(async () => {
      try {
        const result = await previewAssignRemainingToJudge({
          eventId,
          judgeId: next,
        })
        if (selected.current !== next) return
        setError(result.error)
        if (result.plan) setPlan(result.plan)
      } catch {
        if (selected.current === next)
          setError("Could not check assignments. Try again.")
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          selected.current = null
          setJudgeId(null)
          setPlan(null)
          setError(null)
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={!started || eligible.length === 0}
          >
            Assign remaining to judge
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign remaining to judge</AlertDialogTitle>
            <AlertDialogDescription>
              Moves untouched assignments from other judges to the chosen judge,
              up to their capacity, starting with projects that have the fewest
              submitted reviews. Submitted and started reviews never move.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <Label htmlFor={id}>Judge</Label>
            <Select
              value={judgeId ?? undefined}
              onValueChange={choose}
              disabled={pending && plan !== null}
            >
              <SelectTrigger id={id} className="w-full">
                <SelectValue placeholder="Choose a judge" />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((judge) => (
                  <SelectItem key={judge.id} value={judge.id}>
                    {judge.email} ({judge.workload}/{judge.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {judgeId && (
              <p>
                {plan
                  ? assignRemainingPreviewMessage(plan)
                  : !error && "Checking assignments…"}
              </p>
            )}
            {plan && plan.sources.length > 0 && (
              <ul className="list-disc pl-5">
                {plan.sources.map((source) => (
                  <li key={source.judge_id}>
                    {source.count} from {source.email}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || !judgeId || !plan || plan.moved === 0}
              onClick={(event) => {
                event.preventDefault()
                if (!judgeId) return
                setError(null)
                startTransition(async () => {
                  try {
                    const result = await assignRemainingToJudge({
                      eventId,
                      judgeId,
                    })
                    setError(result.error)
                    if (!result.plan) return
                    setOpen(false)
                    setMessage(assignRemainingResultMessage(result.plan))
                  } catch {
                    setError("Could not assign remaining work. Try again.")
                  }
                })
              }}
            >
              {pending && plan ? "Assigning…" : "Assign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </div>
  )
}
