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

import { deleteProjectDraft } from "@/app/(projects)/projects/actions"

export function DeleteDraftButton({
  projectId,
  teammates,
  eventHref,
}: {
  projectId: string
  teammates: { id: string; name: string }[]
  eventHref: string
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="self-start">
          Delete project
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the draft, its answers, and its files. It
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {teammates.length > 0 && (
          <div className="flex flex-col gap-1 text-sm">
            <p>These teammates will be removed and can join other teams:</p>
            <ul className="list-disc pl-5">
              {teammates.map((teammate) => (
                <li key={teammate.id}>{teammate.name}</li>
              ))}
            </ul>
          </div>
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
                try {
                  const result = await deleteProjectDraft(projectId)
                  if (result.error) setError(result.error)
                  else window.location.assign(eventHref)
                } catch {
                  setError("Could not delete the project. Try again.")
                }
              })
            }}
          >
            Delete project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
