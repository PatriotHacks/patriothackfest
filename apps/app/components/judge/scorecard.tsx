"use client"

import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
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
  reviewAverage,
  reviewComplete,
  reviewContext,
  SCORE_MAX,
  type JudgeCriterion,
  type JudgeScorecard,
  type queuePosition,
} from "@/lib/judge-reviews"
import { judgeWindowStatus } from "@/lib/judge-status"
import { JudgeDeadline } from "./deadline"
import { ScoreSlider } from "./score-slider"

export function JudgeScorecardForm({
  assignment,
  criteria,
  event,
  position,
}: {
  assignment: JudgeScorecard
  criteria: JudgeCriterion[]
  event: JudgeEvent
  position: ReturnType<typeof queuePosition>
}) {
  const [state, dispatch] = useReducer(
    reviewFormReducer,
    { assignment, criteria, event },
    initialReviewFormState
  )
  const [pending, startTransition] = useTransition()
  const busy = useRef(false)
  const id = useId()
  const router = useRouter()
  const submitted = Boolean(state.assignment.submitted_at)
  const dirty = reviewIsDirty(state)
  const open = judgeWindowStatus(state.event) === "started"
  const complete = reviewComplete(state.scores)
  const average = reviewAverage(state.scores)

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
  function save(submit: boolean) {
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
        })
        return
      }
      dispatch({
        type: "saved",
        assignment: result.assignment,
        message: submitted
          ? "Changes saved"
          : submit
            ? "Review submitted"
            : "Draft saved",
      })
      if (submitted || !submit) return
      const next = await continueJudgeQueue(
        state.event.slug,
        state.assignment.id
      )
      if (next.error || !next.href) {
        dispatch({
          type: "failure",
          message: `Review submitted. ${next.error ?? "Could not load the next review."}`,
        })
        return
      }
      router.push(next.href)
    })
  }
  function checkDeadline() {
    run(async () => {
      const result = await checkJudgeReview(state.event.slug)
      if (result.error || !result.event) {
        dispatch({
          type: "failure",
          message: result.error ?? "Could not check the deadline",
        })
        return
      }
      dispatch({ type: "checked", event: result.event })
    })
  }
  function confirmLeave(event: React.MouseEvent) {
    if (dirty && !window.confirm("Leave without saving your changes?"))
      event.preventDefault()
  }

  return (
    <section
      className={cn(PAPER, "flex flex-col gap-5 p-6")}
      aria-label="Your scores"
    >
      {position && (
        <nav
          aria-label="Assignments"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {position.previous ? (
            <Link
              href={position.previous}
              onClick={confirmLeave}
              className="underline"
            >
              Previous
            </Link>
          ) : (
            <span aria-hidden className="text-[#6E6E68]">
              Previous
            </span>
          )}
          <span className="font-semibold">
            Project {position.number} of {position.total}
          </span>
          {position.next ? (
            <Link
              href={position.next}
              onClick={confirmLeave}
              className="underline"
            >
              Next
            </Link>
          ) : (
            <span aria-hidden className="text-[#6E6E68]">
              Next
            </span>
          )}
        </nav>
      )}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Your scores</h2>
        <p className="text-sm">
          {reviewContext(state.assignment)}
          {submitted && " · Submitted"}
        </p>
        <JudgeDeadline closeAt={state.event.judging_close_at} />
      </div>
      {criteria.length === 0 ? (
        <p role="status">
          Scoring criteria have not been set up for this event yet. Contact an
          organizer before scoring.
        </p>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            save(true)
          }}
          className="flex flex-col gap-5"
        >
          {!open && (
            <div className="flex flex-col gap-2" role="status">
              <p>
                Judging is not open, so scores cannot be changed. Saved scores
                are kept.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                disabled={pending}
                onClick={checkDeadline}
              >
                Check for an extension
              </Button>
            </div>
          )}
          <fieldset disabled={pending || !open} className="flex flex-col gap-6">
            <legend className="sr-only">Criterion scores</legend>
            {criteria.map((criterion) => (
              <ScoreSlider
                key={criterion.id}
                criterion={criterion}
                value={state.scores[criterion.id] ?? null}
                disabled={pending || !open}
                onChange={(value) =>
                  dispatch({ type: "score", id: criterion.id, value })
                }
              />
            ))}
            <p className="flex justify-between border-t border-[#E7E4D9] pt-4 font-semibold">
              <span>Your average</span>
              <span className="tabular-nums">
                {average === null
                  ? "Score every criterion"
                  : `${average.toFixed(2)} / ${SCORE_MAX}`}
              </span>
            </p>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-notes`}>Private notes (optional)</Label>
              <p className="text-sm text-[#6E6E68]">
                Only organizers see this.
              </p>
              <Textarea
                id={`${id}-notes`}
                rows={4}
                maxLength={5000}
                value={state.notes}
                onChange={(event) =>
                  dispatch({ type: "notes", value: event.target.value })
                }
              />
            </div>
          </fieldset>
          {open && (
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={pending || !complete}>
                {submitted ? "Save changes" : "Submit & next"}
              </Button>
              {!submitted && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => save(false)}
                >
                  Save draft
                </Button>
              )}
            </div>
          )}
          {open && (
            <p className="text-sm text-[#6E6E68]">
              {dirty
                ? "Unsaved changes."
                : submitted
                  ? "You can edit this review until judging closes."
                  : "Score every criterion to submit."}
            </p>
          )}
        </form>
      )}
      <p role="status" aria-live="polite" className="text-sm">
        {state.message}
      </p>
    </section>
  )
}
