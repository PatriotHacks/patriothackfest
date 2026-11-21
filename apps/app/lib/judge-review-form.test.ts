import { describe, expect, it } from "vitest"
import {
  initialReviewFormState,
  reviewFormReducer,
  reviewIsDirty,
} from "./judge-review-form"
import type { JudgeEvent } from "./judge-access"
import type { JudgeCriterion, JudgeScorecard } from "./judge-reviews"
const id = "a0000000-0000-4000-8000-000000000001"
const a = "c0000000-0000-4000-8000-000000000001"
const b = "c0000000-0000-4000-8000-000000000002"
export const event: JudgeEvent = {
  event_id: id,
  slug: "fall-2026",
  name: "Fall",
  kind: "general",
  guest: false,
  capacity: 20,
  enabled: true,
  judging_started_at: "2026-11-18T00:00:00Z",
  judging_close_at: "2099-11-21T05:00:00Z",
  briefing_acknowledged_at: "2026-11-18T00:00:00Z",
  tracks: [],
}
export const criteria: JudgeCriterion[] = [
  { id: a, name: "Criterion A", description: "" },
  { id: b, name: "Criterion B", description: "" },
]
export const assignment: JudgeScorecard = {
  id,
  track_id: null,
  track_name: null,
  scores: { [a]: 2.5 },
  notes: "saved",
  submitted_at: null,
}
describe("controlled scorecard state", () => {
  it("starts every criterion from the saved scores or unset", () => {
    const state = initialReviewFormState({ event, criteria, assignment })
    expect(state.scores).toEqual({ [a]: 2.5, [b]: null })
    expect(reviewIsDirty(state)).toBe(false)
  })
  it("preserves unsaved values on validation, deadline, revocation and transport errors", () => {
    let state = initialReviewFormState({ event, criteria, assignment })
    state = reviewFormReducer(state, { type: "notes", value: "unsaved" })
    state = reviewFormReducer(state, { type: "score", id: b, value: 4.2 })
    for (const message of ["Invalid score", "Judging expired", "Revoked"])
      state = reviewFormReducer(state, { type: "failure", message })
    expect(state.notes).toBe("unsaved")
    expect(state.scores[b]).toBe(4.2)
    expect(reviewIsDirty(state)).toBe(true)
  })
  it("updates extended deadline without resetting dirty fields", () => {
    let state = initialReviewFormState({ event, criteria, assignment })
    state = reviewFormReducer(state, { type: "notes", value: "keep me" })
    state = reviewFormReducer(state, {
      type: "checked",
      event: { ...event, judging_close_at: "2099-11-22T05:00:00Z" },
    })
    expect(state.notes).toBe("keep me")
    expect(state.event.judging_close_at).toContain("11-22")
    expect(state.message).toContain("Judging is open")
  })
  it("keeps submitted reviews editable after saving", () => {
    let state = initialReviewFormState({ event, criteria, assignment })
    state = reviewFormReducer(state, { type: "score", id: a, value: 3 })
    state = reviewFormReducer(state, { type: "score", id: b, value: 4 })
    const submitted = {
      ...assignment,
      scores: { [a]: 3, [b]: 4 },
      submitted_at: "date",
    }
    state = reviewFormReducer(state, {
      type: "saved",
      assignment: submitted,
      message: "Review submitted",
    })
    expect(reviewIsDirty(state)).toBe(false)
    state = reviewFormReducer(state, { type: "score", id: a, value: 3.1 })
    expect(state.scores[a]).toBe(3.1)
    expect(reviewIsDirty(state)).toBe(true)
  })
  it("keeps edits made while a save was in flight", () => {
    let state = initialReviewFormState({ event, criteria, assignment })
    state = reviewFormReducer(state, { type: "notes", value: "first" })
    const saved = { ...assignment, notes: "first" }
    state = reviewFormReducer(state, { type: "notes", value: "second" })
    state = reviewFormReducer(state, {
      type: "saved",
      assignment: saved,
      message: null,
    })
    expect(state.notes).toBe("second")
    expect(reviewIsDirty(state)).toBe(true)
  })
})
