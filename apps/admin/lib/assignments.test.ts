import { describe, expect, it } from "vitest"
import {
  addAssignmentInput,
  assignmentContextLabel,
  assignmentFilters,
  assignmentHref,
  assignmentOverview,
  cancelAssignmentInput,
  generationSummary,
  parseAssignmentQuery,
  rebalancePlan,
  rebalancePreviewMessage,
  rebalanceResultMessage,
} from "./assignments"

const id = "a0000000-0000-4000-8000-000000000001"
describe("assignment contracts", () => {
  it("resets malformed page/project filters without breaking the judging page", () => {
    expect(
      parseAssignmentQuery({
        assignmentPage: "999999999999",
        coveragePage: "2",
        assignmentStatus: "bad",
      })
    ).toEqual({ assignmentPage: 1, coveragePage: 2, status: "all" })
    expect(
      parseAssignmentQuery({ assignmentProject: "bad" }).projectId
    ).toBeUndefined()
    expect(
      parseAssignmentQuery({ assignmentProject: [id, id] }).projectId
    ).toBeUndefined()
  })
  it("distinguishes general and sponsor contexts and rejects untrusted state", () => {
    expect(
      addAssignmentInput.parse({
        eventId: id,
        projectId: id,
        trackId: null,
        judgeId: id,
      }).trackId
    ).toBeNull()
    expect(
      addAssignmentInput.safeParse({ eventId: id, projectId: id, judgeId: id })
        .success
    ).toBe(false)
    expect(
      cancelAssignmentInput.safeParse({
        eventId: id,
        assignmentId: id,
        untouched: true,
      }).success
    ).toBe(false)
    expect(assignmentContextLabel(null)).toBe("General")
    expect(assignmentContextLabel("General")).toBe("Sponsor: General")
  })
  it("validates bounded pages, filters and generated counts", () => {
    expect(assignmentFilters.parse({})).toEqual({
      coveragePage: 1,
      assignmentPage: 1,
      status: "all",
    })
    for (const value of [0, -1, 1.1, 2147483648])
      expect(
        assignmentFilters.safeParse({ assignmentPage: value }).success
      ).toBe(false)
    expect(assignmentFilters.safeParse({ projectId: "bad" }).success).toBe(
      false
    )
    expect(
      generationSummary.safeParse({ created: -1, missing: 0 }).success
    ).toBe(false)
    expect(assignmentOverview.safeParse(null).success).toBe(false)
  })
  it("keeps filters and project pagination in assignment links", () => {
    const href = assignmentHref(
      "event & one",
      {
        coveragePage: 2,
        assignmentPage: 3,
        status: "cancelled",
        projectId: id,
      },
      4
    )
    const url = new URL(href, "https://example.test")
    expect(url.searchParams.get("event")).toBe("event & one")
    expect(url.searchParams.get("assignmentProject")).toBe(id)
    expect(url.searchParams.get("projectsPage")).toBe("4")
    expect(url.hash).toBe("#assignments")
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
