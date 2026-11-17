import { describe, expect, it } from "vitest"
import {
  judgeAssignmentSchema,
  judgeContinuation,
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
})

describe("judge assignment payload", () => {
  const payload = {
    assignment: {
      id,
      track_id: null,
      track_name: null,
      creativity_score: null,
      technical_score: null,
      impact_score: null,
      presentation_score: null,
      total_score: null,
      submitted_at: null,
      notes: "",
    },
    project: {
      name: "Project",
      summary: "",
      description: "",
      technologies: "",
      repository_url: null,
      demo_url: null,
      video_url: null,
    },
    answers: [
      {
        question_id: "b0000000-0000-4000-8000-000000000001",
        label: "Why?",
        type: "long_text",
        options: null,
        answer: "Because",
      },
    ],
  }
  it("accepts question answers and an empty list when hidden", () => {
    expect(judgeAssignmentSchema.parse(payload).answers).toHaveLength(1)
    expect(
      judgeAssignmentSchema.parse({ ...payload, answers: [] }).answers
    ).toEqual([])
  })
  it("accepts typed answers and rejects unknown types", () => {
    const [answer] = payload.answers
    expect(
      judgeAssignmentSchema.safeParse({
        ...payload,
        answers: [
          { ...answer, type: "multiple_choice", options: [], answer: [] },
          { ...answer, type: "file", answer: null },
        ],
      }).success
    ).toBe(true)
    expect(
      judgeAssignmentSchema.safeParse({
        ...payload,
        answers: [{ ...answer, type: "date" }],
      }).success
    ).toBe(false)
  })
  it("rejects payloads without the answers list", () => {
    const { answers: _answers, ...rest } = payload
    expect(judgeAssignmentSchema.safeParse(rest).success).toBe(false)
  })
})
