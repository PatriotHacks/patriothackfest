"use client"

import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import { useRouter } from "next/navigation"
import { useEffect, useId, useReducer, useRef, useTransition } from "react"

import {
  checkJudgeReview,
  continueJudgeQueue,
  saveJudgeReview,
} from "@/app/(judge)/judge/actions"
import type { JudgeEvent } from "@/lib/judge-access"
import {
  initialReviewFormState,
  reviewFormReducer,
  reviewIsDirty,
} from "@/lib/judge-review-form"
import {
  reviewContext,
  reviewCriteria,
  type JudgeScorecard,
} from "@/lib/judge-reviews"
import { judgeWindowStatus } from "@/lib/judge-status"
import { JudgeDeadline } from "./deadline"

export function JudgeScorecardForm({
  assignment,
  event,
}: {
  assignment: JudgeScorecard
  event: JudgeEvent
}) {
  const [state, dispatch] = useReducer(
    reviewFormReducer,
    { assignment, event },
    initialReviewFormState
  )
  const [pending, startTransition] = useTransition()
  const busy = useRef(false)
  const id = useId()
  const router = useRouter()
  const submitted = Boolean(state.assignment.submitted_at)
  const dirty = reviewIsDirty(state)
  const phase = judgeWindowStatus(state.event)

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  function run(task: () => Promise<void>) {
    if (busy.current) return
    busy.current = true
    startTransition(async () => {
      try {
        await task()
      } catch {
        dispatch({
          type: "failure",
          message:
            "Could not complete the request. Your inputs are still here; retry or sign in again if your session expired.",
        })
      } finally {
        busy.current = false
      }
    })
  }
  async function continueNext() {
    try {
      const result = await continueJudgeQueue(state.event.slug)
      if (result.error || !result.href) {
        dispatch({
          type: "failure",
          message:
            result.error ??
            "Review submitted. Could not load the next review; try Continue again.",
        })
        return
      }
      router.push(result.href)
    } catch {
      dispatch({
        type: "failure",
        message:
          "Review submitted. Could not load the next review; try Continue again.",
      })
    }
  }
  function save(submit: boolean) {
    if (submitted) return
    run(async () => {
      const result = await saveJudgeReview({
        eventSlug: state.event.slug,
        assignmentId: state.assignment.id,
        scores: state.scores,
        notes: state.notes,
        submit,
      })
      if (result.error || !result.assignment) {
        dispatch({
          type: "failure",
          message: result.error ?? "Could not save your review",
          fieldErrors: result.fieldErrors,
        })
        return
      }
      dispatch({ type: "saved", assignment: result.assignment })
      if (result.assignment.submitted_at && submit) await continueNext()
    })
  }
  function checkDeadline() {
    run(async () => {
      const result = await checkJudgeReview({
        eventSlug: state.event.slug,
        assignmentId: state.assignment.id,
      })
      if (result.error || !result.event || !result.assignment) {
        dispatch({
          type: "failure",
          message: result.error ?? "Could not check this review",
        })
        return
      }
      dispatch({
        type: "checked",
        event: result.event,
        assignment: result.assignment,
      })
    })
  }
  return (
    <section
      className={cn(PAPER, "flex flex-col gap-4 p-6")}
      aria-label="Your scorecard"
    >
      <h2 className="text-xl font-semibold">
        Your scorecard · {reviewContext(state.assignment)}
      </h2>
      <JudgeDeadline closeAt={state.event.judging_close_at} />
      {!submitted && phase !== "started" && (
        <p role="status">
          Judging is not open. Saved drafts are retained. You can check for an
          extension or retry saving without losing these inputs.
        </p>
      )}
      <p className="text-sm">
        Four fixed criteria, each from 1 to 5. Anchors: 1 = limited evidence, 3
        = solid, 5 = exceptional. Notes are private to your scorecard.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          save(false)
        }}
        className="flex flex-col gap-4"
      >
        <fieldset
          disabled={pending || submitted}
          className="grid gap-4 sm:grid-cols-2"
        >
          <legend className="sr-only">Review scores</legend>
          {reviewCriteria.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1">
              <Label htmlFor={`${id}-${key}`}>{label}</Label>
              <select
                id={`${id}-${key}`}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={state.scores[key] ?? ""}
                onChange={(event) =>
                  dispatch({
                    type: "score",
                    key,
                    value:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  })
                }
                aria-invalid={Boolean(state.fieldErrors[`scores.${key}`])}
                aria-describedby={
                  state.fieldErrors[`scores.${key}`]
                    ? `${id}-${key}-error`
                    : undefined
                }
              >
                <option value="">Not scored</option>
                {[1, 2, 3, 4, 5].map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>
              {state.fieldErrors[`scores.${key}`] && (
                <p id={`${id}-${key}-error`} className="text-sm text-red-700">
                  {state.fieldErrors[`scores.${key}`]}
                </p>
              )}
            </div>
          ))}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor={`${id}-notes`}>Private notes (optional)</Label>
            <Textarea
              id={`${id}-notes`}
              rows={5}
              maxLength={5000}
              value={state.notes}
              onChange={(event) =>
                dispatch({ type: "notes", value: event.target.value })
              }
              aria-invalid={Boolean(state.fieldErrors.notes)}
            />
            {state.fieldErrors.notes && (
              <p className="text-sm text-red-700">{state.fieldErrors.notes}</p>
            )}
          </div>
        </fieldset>
        {submitted ? (
          <>
            <p className="font-semibold">
              Submitted — read-only · Total: {state.assignment.total_score} / 20
            </p>
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(continueNext)}
            >
              Continue to next review / dashboard
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="outline" disabled={pending}>
                {pending ? "Saving…" : "Save draft"}
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => save(true)}
              >
                Submit &amp; next
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={checkDeadline}
              >
                Check deadline / extension
              </Button>
            </div>
            <p className="text-sm">
              {dirty ? "Unsaved changes — save before leaving." : "Draft saved"}{" "}
              Submitted reviews cannot be edited.
            </p>
          </>
        )}
      </form>
      <p role="status" aria-live="polite" className="text-sm">
        {state.message}
      </p>
    </section>
  )
}
