import { describe, expect, it } from "vitest"
import {
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
