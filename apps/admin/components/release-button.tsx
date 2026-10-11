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

import { releaseDecisions } from "@/app/(admin)/forms/[formId]/release/actions"

export function ReleaseButton({
  formId,
  title,
  decided,
  undecided,
  disabledReason,
}: {
  formId: string
  title: string
  decided: number
  undecided: number
  disabledReason: string | null
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button className="w-fit" disabled={disabledReason !== null}>
            Release decisions
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release decisions for {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Applicants see their decisions in the
              portal immediately, and {decided} decision emails are queued for
              sending. Reviewers can no longer change decisions for this form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {undecided > 0 && (
            <p className="text-sm font-medium text-destructive">
              {undecided} submitted applications have no decision. They will
              show &quot;Under review&quot; until an organizer decides, which
              then queues their email.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                setError(null)
                startTransition(async () => {
                  const result = await releaseDecisions(formId)
                  setError(result.error)
                  if (!result.error) setOpen(false)
                })
              }}
            >
              Release decisions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {disabledReason && (
        <p className="text-sm text-muted-foreground">{disabledReason}</p>
      )}
    </div>
  )
}
