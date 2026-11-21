"use client"

import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  useEffect,
  useEffectEvent,
  useId,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react"

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
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(
    null
  )
  const [pending, startTransition] = useTransition()
  const busy = useRef(false)
  const latest = useRef(state)
  const inflight = useRef<Promise<boolean> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const id = useId()
  const router = useRouter()
  const submitted = Boolean(state.assignment.submitted_at)
  const dirty = reviewIsDirty(state)
  const open = judgeWindowStatus(state.event) === "started"
  const complete = reviewComplete(state.scores)
  const average = reviewAverage(state.scores)

  useEffect(() => {
    latest.current = state
  })

  const autosave = useEffectEvent(() => void persist(false))
  useEffect(() => {
    if (!dirty || !open) return
    timer.current = setTimeout(autosave, 800)
    return () => clearTimeout(timer.current)
  }, [dirty, open, state.scores, state.notes])

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
  async function persist(submit: boolean): Promise<boolean> {
    clearTimeout(timer.current)
    while (inflight.current) await inflight.current
    const current = latest.current
    if (!submit && !reviewIsDirty(current)) return true
    setStatus({ error: false, text: "Saving…" })
    const request = saveJudgeReview({
      eventSlug: current.event.slug,
      assignmentId: current.assignment.id,
      scores: current.scores,
      notes: current.notes,
      submit,
    })
      .then(
        (result) => {
          if (result.error || !result.assignment) {
            setStatus({
              error: true,
              text: result.error ?? "Could not save your review",
            })
            return false
          }
          latest.current = { ...latest.current, assignment: result.assignment }
          dispatch({
            type: "saved",
            assignment: result.assignment,
            message: submit ? "Review submitted" : null,
          })
          setStatus({ error: false, text: "Saved" })
          return true
        },
        () => {
          setStatus({
            error: true,
            text: "Could not save. Retry, or sign in again if your session expired.",
          })
          return false
        }
      )
      .then((ok) => {
        inflight.current = null
        return ok
      })
    inflight.current = request
    return request
  }
  function submit() {
    run(async () => {
      if (!(await persist(true))) return
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
  function leave(event: React.MouseEvent, href: string) {
    if (!dirty) return
    event.preventDefault()
    run(async () => {
      if (
        (await persist(false)) ||
        window.confirm("Leave without saving your changes?")
      )
        router.push(href)
    })
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
              onClick={(event) => leave(event, position.previous!)}
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
              onClick={(event) => leave(event, position.next!)}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Your scores</h2>
          {open && criteria.length > 0 && (
            <div className="flex items-center gap-3">
              {status && (
                <span
                  role={status.error ? "alert" : undefined}
                  className={cn(
                    "text-sm",
                    status.error ? "text-red-700" : "text-[#6E6E68]"
                  )}
                >
                  {status.text}
                </span>
              )}
              {!submitted && (
                <Button
                  type="submit"
                  form={`${id}-form`}
                  disabled={pending || !complete}
                >
                  Submit & next
                </Button>
              )}
            </div>
          )}
        </div>
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
          id={`${id}-form`}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (!submitted && complete) submit()
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
                  : average.toFixed(2)}
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
            <p className="text-sm text-[#6E6E68]">
              {submitted
                ? "You can edit this review until judging closes. Changes save automatically."
                : "Your draft saves automatically. Score every criterion to submit."}
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
