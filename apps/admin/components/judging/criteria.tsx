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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useId, useState, useTransition } from "react"

import {
  deleteJudgingCriterion,
  reorderJudgingCriteria,
  saveJudgingCriterion,
} from "@/app/(admin)/judging/criteria-actions"
import type { JudgingCriterion } from "@/lib/judging-criteria"

function CriterionForm({
  eventId,
  criterion,
}: {
  eventId: string
  criterion?: JudgingCriterion
}) {
  const id = useId()
  const [name, setName] = useState(criterion?.name ?? "")
  const [description, setDescription] = useState(criterion?.description ?? "")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      aria-label={criterion ? `Edit ${criterion.name}` : "Add criterion"}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        setMessage(null)
        startTransition(async () => {
          try {
            const result = await saveJudgingCriterion({
              eventId,
              criterionId: criterion?.id,
              name,
              description,
            })
            setMessage(
              result.error ??
                (criterion ? "Criterion saved" : "Criterion added")
            )
            if (!result.error && !criterion) {
              setName("")
              setDescription("")
            }
          } catch {
            setMessage("Could not save criterion. Try again.")
          }
        })
      }}
    >
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-name`}>
            {criterion ? "Criterion" : "New criterion"}
          </Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-description`}>Description (optional)</Label>
          <Textarea
            id={`${id}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
          />
        </div>
        <Button type="submit" variant="outline" className="w-fit">
          {criterion ? "Save criterion" : "Add criterion"}
        </Button>
      </fieldset>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </form>
  )
}

function DeleteCriterionDialog({
  eventId,
  criterion,
}: {
  eventId: string
  criterion: JudgingCriterion
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete criterion</AlertDialogTitle>
          <AlertDialogDescription>
            Remove {criterion.name} from this event&apos;s rubric?
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
            onClick={(event) => {
              event.preventDefault()
              setError(null)
              startTransition(async () => {
                try {
                  const result = await deleteJudgingCriterion({
                    eventId,
                    criterionId: criterion.id,
                  })
                  setError(result.error)
                  if (!result.error) setOpen(false)
                } catch {
                  setError("Could not delete criterion. Try again.")
                }
              })
            }}
          >
            {pending ? "Deleting…" : "Delete criterion"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function JudgingCriteria({
  eventId,
  criteria,
  locked,
}: {
  eventId: string
  criteria: JudgingCriterion[]
  locked: boolean
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function move(index: number, offset: number) {
    const ids = criteria.map((criterion) => criterion.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + offset, 0, moved!)
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await reorderJudgingCriteria({
          eventId,
          criterionIds: ids,
        })
        if (result.error) setMessage(result.error)
      } catch {
        setMessage("Could not reorder criteria. Try again.")
      }
    })
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="rubric-heading">
      <h2 id="rubric-heading" className="text-xl font-semibold">
        Rubric
      </h2>
      <p className="text-sm text-muted-foreground">
        Judges score each criterion from 1.0 to 5.0. A judge&apos;s score for a
        project is the average of their criterion scores. Only organizers and
        this event&apos;s judges can see the rubric.
      </p>
      {criteria.length === 0 && (
        <p className="text-sm">
          No criteria yet. Add at least one before starting judging.
        </p>
      )}
      {locked ? (
        <>
          <ol className="flex list-outside list-decimal flex-col gap-3 pl-5">
            {criteria.map((criterion) => (
              <li key={criterion.id}>
                <p className="font-medium break-words">{criterion.name}</p>
                {criterion.description && (
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {criterion.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            The rubric is locked because judging has started.
          </p>
        </>
      ) : (
        <>
          {criteria.map((criterion, index) => (
            <div
              key={criterion.id}
              className="flex flex-col gap-3 rounded-lg border p-4"
            >
              <CriterionForm eventId={eventId} criterion={criterion} />
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || index === 0}
                  onClick={() => move(index, -1)}
                >
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || index === criteria.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Move down
                </Button>
                <DeleteCriterionDialog
                  eventId={eventId}
                  criterion={criterion}
                />
              </div>
            </div>
          ))}
          {message && (
            <p role="alert" className="text-sm text-red-700">
              {message}
            </p>
          )}
          <div className="rounded-lg border border-dashed p-4">
            <CriterionForm key={`new-${eventId}`} eventId={eventId} />
          </div>
        </>
      )}
    </section>
  )
}
