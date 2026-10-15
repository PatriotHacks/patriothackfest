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
import { OUTLINE_PILL } from "@workspace/ui/lib/brand"
import { useState, useTransition } from "react"

import { declineOffer } from "@/app/(applicant)/(main)/applications/[id]/actions"
import type { DeclinableDecision } from "@/lib/application-status"

const COPY = {
  accepted: {
    trigger: "Decline my spot",
    title: "Decline your spot?",
    description: (event: string) =>
      `Declining is final and cannot be undone. You will give up your spot at ${event}.`,
    confirm: "Decline spot",
  },
  waitlisted: {
    trigger: "Leave waitlist",
    title: "Leave the waitlist?",
    description: (event: string) =>
      `Leaving the waitlist is final and cannot be undone. You will no longer be considered for a spot at ${event}.`,
    confirm: "Leave waitlist",
  },
}

export function DeclineButton({
  applicationId,
  eventName,
  decision,
}: {
  applicationId: string
  eventName: string
  decision: DeclinableDecision
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const copy = COPY[decision]

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className={OUTLINE_PILL}>
          {copy.trigger}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy.description(eventName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
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
                const result = await declineOffer(applicationId)
                setError(result.error)
                if (!result.error) setOpen(false)
              })
            }}
          >
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
