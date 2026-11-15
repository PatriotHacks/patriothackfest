import { describe, expect, it } from "vitest"
import {
  initialReviewFormState,
  reviewFormReducer,
  reviewIsDirty,
} from "./judge-review-form"
import type { JudgeEvent } from "./judge-access"
import type { JudgeScorecard } from "./judge-reviews"
const id = "a0000000-0000-4000-8000-000000000001"
export const event: JudgeEvent = {
  event_id: id,
  slug: "fall-2026",
  name: "Fall",
  kind: "general",
  capacity: 20,
  enabled: true,
  judging_started_at: "2026-11-18T00:00:00Z",
  judging_close_at: "2099-11-21T05:00:00Z",
  tracks: [],
}
export const assignment: JudgeScorecard = {
  id,
  track_id: null,
  track_name: null,
  creativity_score: null,
  technical_score: null,
  impact_score: null,
  presentation_score: null,
  notes: "saved",
  submitted_at: null,
  total_score: null,
}
describe("controlled scorecard state", () => {
  it("preserves unsaved values on validation, deadline, revocation and transport errors", () => {
    let state = initialReviewFormState({ event, assignment })
    state = reviewFormReducer(state, { type: "notes", value: "unsaved" })
    state = reviewFormReducer(state, {
      type: "score",
      key: "creativity_score",
      value: 4,
    })
    for (const message of [
      "Invalid score",
      "Judging expired",
      "Revoked",
      "Network unavailable",
    ])
      state = reviewFormReducer(state, { type: "failure", message })
    expect(state.notes).toBe("unsaved")
    expect(state.scores.creativity_score).toBe(4)
    expect(reviewIsDirty(state)).toBe(true)
    expect(state.assignment.submitted_at).toBeNull()
  })
  it("updates extended deadline without resetting dirty fields to the saved draft", () => {
    let state = initialReviewFormState({ event, assignment })
    state = reviewFormReducer(state, { type: "notes", value: "keep me" })
    state = reviewFormReducer(state, {
      type: "checked",
      event: { ...event, judging_close_at: "2099-11-22T05:00:00Z" },
      assignment,
    })
    expect(state.notes).toBe("keep me")
    expect(state.event.judging_close_at).toContain("11-22")
    expect(state.message).toContain("Judging is open")
  })
  it("locks successful/repeated submission even when queue refresh fails", () => {
    let state = initialReviewFormState({ event, assignment })
    const submitted = {
      ...assignment,
      creativity_score: 3,
      technical_score: 3,
      impact_score: 3,
      presentation_score: 3,
      submitted_at: "date",
      total_score: 12,
    }
    state = reviewFormReducer(state, { type: "saved", assignment: submitted })
    state = reviewFormReducer(state, {
      type: "failure",
      message: "Queue unavailable",
    })
    state = reviewFormReducer(state, { type: "notes", value: "overwrite" })
    expect(state.assignment.submitted_at).toBe("date")
    expect(state.notes).toBe("saved")
    expect(reviewIsDirty(state)).toBe(false)
    state = reviewFormReducer(state, { type: "checked", event, assignment })
    expect(state.assignment.submitted_at).toBe("date")
  })
})
