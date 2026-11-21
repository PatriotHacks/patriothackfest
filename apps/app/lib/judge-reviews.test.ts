import { describe, expect, it } from "vitest"
import {
  judgeAssignmentSchema,
  judgeContinuation,
  queuePosition,
  reviewAverage,
  reviewComplete,
  reviewContext,
  reviewSaveSchema,
  type JudgeQueue,
} from "./judge-reviews"

const id = "a0000000-0000-4000-8000-000000000001"
const other = "a0000000-0000-4000-8000-000000000002"
const draft = {
  eventSlug: "fall-2026",
  assignmentId: id,
  scores: { [id]: null, [other]: 3.7 },
  notes: "private",
  submit: false,
}
const queue = (submitted: (string | null)[]): JudgeQueue => ({
  total: submitted.length,
  completed: submitted.filter(Boolean).length,
  assignments: submitted.map((submitted_at, index) => ({
    id: `a0000000-0000-4000-8000-00000000000${index + 1}`,
    project_name: `Project ${index + 1}`,
    track_id: null,
    track_name: null,
    submitted_at,
    in_progress: false,
  })),
})
describe("judge scorecard contracts", () => {
  it("permits partial drafts and final submissions of criterion scores", () => {
    expect(reviewSaveSchema.safeParse(draft).success).toBe(true)
    expect(reviewSaveSchema.safeParse({ ...draft, submit: true }).success).toBe(
      true
    )
  })
  it.each([1, 1.1, 3.7, 4.9, 5])("accepts score %s", (score) => {
    expect(
      reviewSaveSchema.safeParse({ ...draft, scores: { [id]: score } }).success
    ).toBe(true)
  })
  it.each([0, 0.9, 5.1, 2.55, "3", NaN])(
    "rejects invalid score %s",
    (score) => {
      expect(
        reviewSaveSchema.safeParse({ ...draft, scores: { [id]: score } })
          .success
      ).toBe(false)
    }
  )
  it("bounds notes and rejects non-criterion keys and extra fields", () => {
    expect(
      reviewSaveSchema.safeParse({ ...draft, notes: "n".repeat(5001) }).success
    ).toBe(false)
    expect(
      reviewSaveSchema.safeParse({ ...draft, scores: { creativity: 3 } })
        .success
    ).toBe(false)
    expect(reviewSaveSchema.safeParse({ ...draft, total: 5 }).success).toBe(
      false
    )
  })
  it("averages only complete scorecards", () => {
    expect(reviewComplete({})).toBe(false)
    expect(reviewComplete({ [id]: 3, [other]: null })).toBe(false)
    expect(reviewAverage({ [id]: 3, [other]: null })).toBeNull()
    expect(reviewAverage({ [id]: 3.5, [other]: 4 })).toBe(3.75)
  })
  it("keeps sponsor contexts distinct", () => {
    expect(reviewContext({ track_id: null, track_name: null })).toBe(
      "General judging"
    )
    expect(reviewContext({ track_id: id, track_name: "Track A" })).toBe(
      "Sponsor track: Track A"
    )
  })
  it("continues in fixed order, wrapping to earlier skipped reviews", () => {
    expect(judgeContinuation("fall-2026", queue([]))).toBe("/judge")
    expect(judgeContinuation("fall-2026", queue([null, null]))).toBe(
      `/judge/fall-2026/${id}`
    )
    expect(judgeContinuation("fall-2026", queue([null, null]), id)).toBe(
      `/judge/fall-2026/${other}`
    )
    expect(judgeContinuation("fall-2026", queue([null, "done"]), id)).toBe(
      `/judge/fall-2026/${id}`
    )
    expect(judgeContinuation("fall-2026", queue(["done", "done"]), id)).toBe(
      "/judge"
    )
  })
  it("locates an assignment with previous and next links", () => {
    expect(queuePosition("fall-2026", queue([null, null]), other)).toEqual({
      number: 2,
      total: 2,
      previous: `/judge/fall-2026/${id}`,
      next: null,
    })
    expect(queuePosition("fall-2026", queue([null]), other)).toBeNull()
  })
})

describe("judge assignment payload", () => {
  const payload = {
    assignment: {
      id,
      track_id: null,
      track_name: null,
      scores: { [other]: 4.5 },
      submitted_at: null,
      notes: "",
    },
    project: { name: "Project" },
    criteria: [{ id: other, name: "Criterion A", description: "" }],
    answers: [
      {
        question_id: "b0000000-0000-4000-8000-000000000001",
        label: "Why?",
        type: "long_text",
        options: null,
        answer: "Because",
      },
    ],
    team: [],
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
  it("accepts team names, including blank ones", () => {
    expect(
      judgeAssignmentSchema.parse({ ...payload, team: ["Ada", null] }).team
    ).toEqual(["Ada", null])
    const { team: _team, ...rest } = payload
    expect(judgeAssignmentSchema.safeParse(rest).success).toBe(false)
  })
  it("requires the event criteria", () => {
    const { criteria: _criteria, ...rest } = payload
    expect(judgeAssignmentSchema.safeParse(rest).success).toBe(false)
  })
  it("rejects payloads without the answers list", () => {
    const { answers: _answers, ...rest } = payload
    expect(judgeAssignmentSchema.safeParse(rest).success).toBe(false)
  })
})
