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
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { useState, useTransition } from "react"

import { deleteProjectDraft } from "@/app/(projects)/projects/actions"
import { hasDraftLosses, type DraftLosses } from "@/lib/projects"

export function DeleteDraftButton({
  projectId,
  losses,
}: {
  projectId: string
  losses: DraftLosses
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const { name, answered, teammates, tracks } = losses

  function remove() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteProjectDraft(projectId)
        if (result.error) setError(result.error)
        else window.location.reload()
      } catch {
        setError("Could not delete the project. Try again.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={pending}
        onClick={() => (hasDraftLosses(losses) ? setOpen(true) : remove())}
      >
        Delete project
      </Button>
      {error && !open && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the draft. It cannot be undone. You will
              lose:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc pl-5 text-sm">
            {name && <li>The project name “{name}”</li>}
            {answered > 0 && (
              <li>
                {answered} answered {answered === 1 ? "question" : "questions"}
              </li>
            )}
            {teammates.length > 0 && (
              <li>
                {teammates.length}{" "}
                {teammates.length === 1 ? "teammate" : "teammates"}:{" "}
                {teammates.join(", ")} (they can join other teams)
              </li>
            )}
            {tracks.length > 0 && <li>Tracks: {tracks.join(", ")}</li>}
          </ul>
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
                remove()
              }}
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
