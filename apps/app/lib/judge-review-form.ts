import type { JudgeEvent } from "./judge-access"
import {
  reviewScores,
  type JudgeCriterion,
  type JudgeScorecard,
  type ReviewScores,
} from "./judge-reviews"
import { judgeWindowStatus } from "./judge-status"

export type ReviewFormState = {
  assignment: JudgeScorecard
  criteria: JudgeCriterion[]
  event: JudgeEvent
  scores: ReviewScores
  notes: string
  message: string | null
}
type ReviewFormAction =
  | { type: "score"; id: string; value: number }
  | { type: "notes"; value: string }
  | { type: "failure"; message: string }
  | { type: "saved"; assignment: JudgeScorecard; message: string }
  | { type: "checked"; event: JudgeEvent }

export function initialReviewFormState(value: {
  assignment: JudgeScorecard
  criteria: JudgeCriterion[]
  event: JudgeEvent
}): ReviewFormState {
  return {
    ...value,
    scores: reviewScores(value.assignment, value.criteria),
    notes: value.assignment.notes,
    message: null,
  }
}

export function reviewFormReducer(
  state: ReviewFormState,
  action: ReviewFormAction
): ReviewFormState {
  switch (action.type) {
    case "score":
      return {
        ...state,
        scores: { ...state.scores, [action.id]: action.value },
      }
    case "notes":
      return { ...state, notes: action.value }
    case "failure":
      return { ...state, message: action.message }
    case "saved":
      return {
        ...state,
        assignment: action.assignment,
        scores: reviewScores(action.assignment, state.criteria),
        notes: action.assignment.notes,
        message: action.message,
      }
    case "checked":
      // Refreshing the deadline never replaces unsaved inputs.
      return {
        ...state,
        event: action.event,
        message:
          judgeWindowStatus(action.event) === "started"
            ? "Judging is open. Your inputs are still here; save or submit to continue."
            : "Judging is not open. Your inputs are still here; retry after an organizer extends the deadline.",
      }
  }
}

export function reviewIsDirty(state: ReviewFormState) {
  return (
    state.notes !== state.assignment.notes ||
    JSON.stringify(state.scores) !==
      JSON.stringify(reviewScores(state.assignment, state.criteria))
  )
}
