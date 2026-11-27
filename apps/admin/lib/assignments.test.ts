import { describe, expect, it } from "vitest"
import {
  assignRemainingInput,
  assignRemainingPlan,
  assignRemainingPreviewMessage,
  assignRemainingResultMessage,
  assignmentOverview,
  generationSummary,
  rebalancePlan,
  rebalancePreviewMessage,
  rebalanceResultMessage,
} from "./assignments"

describe("assignment contracts", () => {
  it("validates generated counts and the overview", () => {
    expect(
      generationSummary.safeParse({ created: -1, missing: 0 }).success
    ).toBe(false)
    expect(assignmentOverview.safeParse(null).success).toBe(false)
    expect(assignmentOverview.parse({ missing: 2, coverage: [] })).toEqual({
      missing: 2,
    })
  })
})

describe("rebalance messages", () => {
  const plan = (moved: number, spread: number) =>
    rebalancePlan.parse({ moved, spread, transfers: [] })
  it("describes the preview", () => {
    expect(rebalancePreviewMessage(plan(3, 1))).toBe(
      "3 untouched assignments will move."
    )
    expect(rebalancePreviewMessage(plan(0, 0))).toBe(
      "No assignments can be moved."
    )
    expect(rebalancePreviewMessage(plan(1, 2))).toBe(
      "1 untouched assignment will move. The busiest and least busy judges still differ by 2 assignments; the rest is started, submitted, or has no eligible judge with room."
    )
  })
  it("describes the result", () => {
    expect(rebalanceResultMessage(plan(1, 0))).toBe("Moved 1 assignment.")
    expect(rebalanceResultMessage(plan(2, 3))).toContain("still differ by 3")
  })
  it("rejects malformed plans", () => {
    expect(
      rebalancePlan.safeParse({ moved: -1, spread: 0, transfers: [] }).success
    ).toBe(false)
  })
})

describe("assign remaining messages", () => {
  const plan = (moved: number, skipped = {}) =>
    assignRemainingPlan.parse({
      moved,
      skipped: {
        conflict: 0,
        ineligible_track: 0,
        capacity: 0,
        previously_held: 0,
        ...skipped,
      },
      sources: [],
    })
  it("describes the preview", () => {
    expect(assignRemainingPreviewMessage(plan(2))).toBe(
      "2 untouched assignments will move."
    )
    expect(assignRemainingPreviewMessage(plan(0))).toBe(
      "No assignments can be moved."
    )
    expect(
      assignRemainingPreviewMessage(
        plan(1, { capacity: 3, conflict: 1, previously_held: 2 })
      )
    ).toBe(
      "1 untouched assignment will move. Skipped: 3 over the judge's capacity, 1 on the judge's own team, 2 already held by the judge."
    )
  })
  it("describes the result", () => {
    expect(assignRemainingResultMessage(plan(1))).toBe("Moved 1 assignment.")
    expect(assignRemainingResultMessage(plan(0, { ineligible_track: 4 }))).toBe(
      "Moved 0 assignments. Skipped: 4 outside the judge's tracks."
    )
  })
  it("rejects malformed plans and input", () => {
    expect(
      assignRemainingPlan.safeParse({ moved: 1, skipped: {}, sources: [] })
        .success
    ).toBe(false)
    expect(
      assignRemainingInput.safeParse({
        eventId: "a0000000-0000-4000-8000-000000000001",
      }).success
    ).toBe(false)
  })
})
