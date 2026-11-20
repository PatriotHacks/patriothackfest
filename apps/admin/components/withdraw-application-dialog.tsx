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
  restoreApplication,
  withdrawApplication,
} from "@/app/(admin)/applications/actions"

export function WithdrawApplicationDialog({
  applicationId,
  withdrawn,
  blockedReason,
}: {
  applicationId: string
  withdrawn: boolean
  blockedReason: string | null
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const label = withdrawn ? "Restore application" : "Withdraw application"

  return (
    <div className="flex flex-col gap-2">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          setError(null)
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="w-fit"
            disabled={blockedReason !== null}
          >
            {label}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label}</AlertDialogTitle>
            <AlertDialogDescription>
              {withdrawn
                ? "The application returns to submitted with its answers and decision intact. This fails if the applicant is an active judge for this event."
                : "The application is marked withdrawn and any unsent decision emails are cancelled. Its answers and decision are kept so it can be restored. A withdrawn participant's email can then be added as a judge for this event. The applicant is not emailed."}
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
              variant={withdrawn ? "default" : "destructive"}
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                setError(null)
                startTransition(async () => {
                  const result = withdrawn
                    ? await restoreApplication(applicationId)
                    : await withdrawApplication(applicationId)
                  setError(result.error)
                  if (!result.error) setOpen(false)
                })
              }}
            >
              {withdrawn ? "Restore" : "Withdraw"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {blockedReason && (
        <p className="text-sm text-muted-foreground">{blockedReason}</p>
      )}
    </div>
  )
}
