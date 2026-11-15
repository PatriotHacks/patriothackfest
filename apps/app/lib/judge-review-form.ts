import type { JudgeEvent } from "./judge-access"
import {
  reviewScores,
  type JudgeScorecard,
  type ReviewScores,
} from "./judge-reviews"
import { judgeWindowStatus } from "./judge-status"

export type ReviewFormState = {
  assignment: JudgeScorecard
  event: JudgeEvent
  scores: ReviewScores
  notes: string
  message: string | null
  fieldErrors: Record<string, string>
}
type ReviewFormAction =
  | { type: "score"; key: keyof ReviewScores; value: number | null }
  | { type: "notes"; value: string }
  | { type: "failure"; message: string; fieldErrors?: Record<string, string> }
  | { type: "saved"; assignment: JudgeScorecard }
  | { type: "checked"; event: JudgeEvent; assignment: JudgeScorecard }

export function initialReviewFormState(value: {
  assignment: JudgeScorecard
  event: JudgeEvent
}): ReviewFormState {
  return {
    ...value,
    scores: reviewScores(value.assignment),
    notes: value.assignment.notes,
    message: null,
    fieldErrors: {},
  }
}

export function reviewFormReducer(
  state: ReviewFormState,
  action: ReviewFormAction
): ReviewFormState {
  switch (action.type) {
    case "score":
      return state.assignment.submitted_at
        ? state
        : { ...state, scores: { ...state.scores, [action.key]: action.value } }
    case "notes":
      return state.assignment.submitted_at
        ? state
        : { ...state, notes: action.value }
    case "failure":
      return {
        ...state,
        message: action.message,
        fieldErrors: action.fieldErrors ?? {},
      }
    case "saved":
      return {
        ...state,
        assignment: action.assignment,
        scores: reviewScores(action.assignment),
        notes: action.assignment.notes,
        fieldErrors: {},
        message: action.assignment.submitted_at
          ? "Review submitted. This scorecard is read-only."
          : "Draft saved",
      }
    case "checked": {
      // Updating the deadline must not replace dirty inputs with the saved draft.
      // Only an authoritative submitted response replaces/locks the local draft.
      const current = action.assignment.submitted_at
        ? reviewFormReducer(state, {
            type: "saved",
            assignment: action.assignment,
          })
        : state
      return {
        ...current,
        event: action.event,
        message: current.assignment.submitted_at
          ? "Review submitted. This scorecard is read-only."
          : judgeWindowStatus(action.event) === "started"
            ? "Judging is open. Your inputs are still here; save or submit to continue."
            : "Judging is not open. Your inputs are still here; retry after an organizer extends the deadline.",
      }
    }
  }
}

export function reviewIsDirty(state: ReviewFormState) {
  return (
    !state.assignment.submitted_at &&
    (state.notes !== state.assignment.notes ||
      JSON.stringify(state.scores) !==
        JSON.stringify(reviewScores(state.assignment)))
  )
}
