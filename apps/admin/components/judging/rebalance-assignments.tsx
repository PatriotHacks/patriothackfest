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
import { useState, useTransition } from "react"
import {
  previewRebalanceAssignments,
  rebalanceAssignments,
} from "@/app/(admin)/judging/assignments-actions"
import {
  rebalancePreviewMessage,
  rebalanceResultMessage,
  type RebalancePlan,
} from "@/lib/assignments"

export function RebalanceAssignments({
  eventId,
  started,
}: {
  eventId: string
  started: boolean
}) {
  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState<RebalancePlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col items-start gap-2">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          setError(null)
          setPlan(null)
          if (!next) return
          startTransition(async () => {
            try {
              const result = await previewRebalanceAssignments({ eventId })
              setError(result.error)
              if (result.plan) setPlan(result.plan)
            } catch {
              setError("Could not check assignments. Try again.")
            }
          })
        }}
      >
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" disabled={!started}>
            Rebalance assignments
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rebalance assignments</AlertDialogTitle>
            <AlertDialogDescription>
              Moves untouched assignments from the busiest active judges to the
              least busy ones. Submitted and started reviews never move, and
              guest and inactive judges are left out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <p>
              {plan
                ? rebalancePreviewMessage(plan)
                : !error && "Checking assignments…"}
            </p>
            {plan && plan.transfers.length > 0 && (
              <ul className="list-disc pl-5">
                {plan.transfers.map((transfer) => (
                  <li key={`${transfer.from_judge_id}:${transfer.to_judge_id}`}>
                    {transfer.count} from {transfer.from_email} to{" "}
                    {transfer.to_email}
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
              disabled={pending || !plan || plan.moved === 0}
              onClick={(event) => {
                event.preventDefault()
                setError(null)
                startTransition(async () => {
                  try {
                    const result = await rebalanceAssignments({ eventId })
                    setError(result.error)
                    if (!result.plan) return
                    setOpen(false)
                    setMessage(rebalanceResultMessage(result.plan))
                  } catch {
                    setError("Could not rebalance assignments. Try again.")
                  }
                })
              }}
            >
              {pending && plan ? "Rebalancing…" : "Rebalance"}
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
