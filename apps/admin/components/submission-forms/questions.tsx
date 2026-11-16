"use client"

import type { Tables } from "@workspace/supabase/types"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useId, useState, useTransition } from "react"

import {
  archiveProjectQuestion,
  reorderProjectQuestions,
  saveProjectQuestion,
} from "@/app/(admin)/submission-forms/actions"

type Question = Tables<"project_questions">

function QuestionForm({
  eventId,
  question,
  locked,
}: {
  eventId: string
  question?: Question
  locked: boolean
}) {
  const id = useId()
  const [label, setLabel] = useState(question?.label ?? "")
  const [helpText, setHelpText] = useState(question?.help_text ?? "")
  const [required, setRequired] = useState(question?.required ?? false)
  const [maxLength, setMaxLength] = useState(question?.max_length ?? 5000)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        setMessage(null)
        startTransition(async () => {
          try {
            const result = await saveProjectQuestion({
              eventId,
              questionId: question?.id,
              label,
              helpText,
              required,
              maxLength,
            })
            setMessage(
              result.error ?? (question ? "Question saved" : "Question added")
            )
            if (!result.error && !question) {
              setLabel("")
              setHelpText("")
              setRequired(false)
              setMaxLength(5000)
            }
          } catch {
            setMessage("Could not save question. Try again.")
          }
        })
      }}
    >
      <fieldset disabled={pending || locked} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-label`}>
            {question ? "Question" : "New question"}
          </Label>
          <Input
            id={`${id}-label`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={300}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-help`}>Help text (optional)</Label>
          <Textarea
            id={`${id}-help`}
            value={helpText}
            onChange={(event) => setHelpText(event.target.value)}
            maxLength={1000}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-max`}>Maximum characters</Label>
            <Input
              id={`${id}-max`}
              type="number"
              min={1}
              max={10_000}
              value={maxLength}
              onChange={(event) => setMaxLength(Number(event.target.value))}
              required
              className="max-w-32"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
            />
            Required to submit
          </label>
        </div>
        {!locked && (
          <Button type="submit" variant="outline" className="w-fit">
            {question ? "Save question" : "Add question"}
          </Button>
        )}
      </fieldset>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </form>
  )
}

export function ProjectQuestions({
  eventId,
  questions,
  locked,
}: {
  eventId: string
  questions: Question[]
  locked: boolean
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ error: string | null }>) {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (result.error) setMessage(result.error)
      } catch {
        setMessage("Could not update questions. Try again.")
      }
    })
  }

  function move(index: number, offset: number) {
    const ids = questions.map((question) => question.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + offset, 0, moved!)
    run(() => reorderProjectQuestions(eventId, ids))
  }

  return (
    <div className="flex flex-col gap-4">
      {questions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No paragraph questions for this event.
        </p>
      )}
      {questions.map((question, index) => (
        <div
          key={question.id}
          className="flex flex-col gap-3 rounded-lg border p-4"
        >
          <QuestionForm eventId={eventId} question={question} locked={locked} />
          {!locked && (
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
                disabled={pending || index === questions.length - 1}
                onClick={() => move(index, 1)}
              >
                Move down
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Archive this question? Participants and judges will no longer see it or its answers."
                    )
                  )
                    return
                  run(() => archiveProjectQuestion(eventId, question.id))
                }}
              >
                Archive
              </Button>
            </div>
          )}
        </div>
      ))}
      {message && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
      {locked ? (
        <p className="text-sm text-muted-foreground">
          Questions are locked because judging has started.
        </p>
      ) : (
        <div className="rounded-lg border border-dashed p-4">
          <QuestionForm
            key={`new-${eventId}`}
            eventId={eventId}
            locked={false}
          />
        </div>
      )}
    </div>
  )
}
