import { describe, expect, it } from "vitest"
import {
  judgeContinuation,
  judgeProjectUrl,
  reviewContext,
  reviewSaveSchema,
} from "./judge-reviews"

const id = "a0000000-0000-4000-8000-000000000001"
const draft = {
  eventSlug: "fall-2026",
  assignmentId: id,
  scores: {
    creativity_score: null,
    technical_score: 3,
    impact_score: null,
    presentation_score: 5,
  },
  notes: "private",
  submit: false,
}
describe("judge scorecard contracts", () => {
  it("permits incomplete drafts but requires all four final scores", () => {
    expect(reviewSaveSchema.safeParse(draft).success).toBe(true)
    expect(reviewSaveSchema.safeParse({ ...draft, submit: true }).success).toBe(
      false
    )
  })
  it.each([0, 6, 2.5, "3", NaN])("rejects invalid score %s", (score) => {
    expect(
      reviewSaveSchema.safeParse({
        ...draft,
        scores: { ...draft.scores, creativity_score: score },
      }).success
    ).toBe(false)
  })
  it("bounds notes and rejects trusted totals", () => {
    expect(
      reviewSaveSchema.safeParse({ ...draft, notes: "n".repeat(5001) }).success
    ).toBe(false)
    expect(reviewSaveSchema.safeParse({ ...draft, total: 20 }).success).toBe(
      false
    )
  })
  it("keeps sponsor contexts distinct and selects first unfinished review", () => {
    expect(reviewContext({ track_id: null, track_name: null })).toBe(
      "General judging"
    )
    expect(reviewContext({ track_id: id, track_name: "Track A" })).toBe(
      "Sponsor track: Track A"
    )
    expect(
      judgeContinuation("fall-2026", {
        total: 0,
        completed: 0,
        assignments: [],
      })
    ).toBe("/judge/fall-2026")
    expect(
      judgeContinuation("fall-2026", {
        total: 1,
        completed: 0,
        assignments: [
          {
            id,
            project_name: "Project",
            track_id: id,
            track_name: "Track A",
            submitted_at: null,
            in_progress: false,
          },
        ],
      })
    ).toBe(`/judge/fall-2026/${id}`)
  })
  it.each([
    "javascript:alert(1)",
    "//evil.test",
    "https://user:pass@example.test",
    "https://example.test\\bad",
  ])("rejects unsafe project link %s", (url) => {
    expect(judgeProjectUrl(url)).toBeNull()
  })
})
