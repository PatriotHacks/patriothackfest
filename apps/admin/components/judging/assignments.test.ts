import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/judging/assignments-actions", () => ({
  generateAssignments: vi.fn(),
  previewRebalanceAssignments: vi.fn(),
  rebalanceAssignments: vi.fn(),
}))
import { AssignmentsSection } from "./assignments"
import type { AssignmentOverview } from "@/lib/assignments"
import { judgeProgress } from "@/lib/judge-progress"
const id = "a0000000-0000-4000-8000-000000000001"
const data: AssignmentOverview = { missing: 2 }
const progress = judgeProgress([
  {
    judge_id: id,
    email: "done@example.test",
    active: true,
    completed: 3,
    in_progress: 0,
    not_started: 1,
  },
  {
    judge_id: "a0000000-0000-4000-8000-000000000002",
    email: "slow@example.test",
    active: false,
    completed: 1,
    in_progress: 2,
    not_started: 4,
  },
])
const render = (started = false, overview = data, judges = progress) =>
  renderToStaticMarkup(
    createElement(AssignmentsSection, {
      eventId: id,
      started,
      data: overview,
      progress: judges,
    })
  )
describe("organizer assignments", () => {
  it("shows the missing slot count without a coverage table", () => {
    const html = render()
    expect(html).toContain("2 missing review slots across this event")
    expect(html).toContain("does not guarantee optimal coverage")
    expect(html).not.toContain("Project coverage")
    expect(html).not.toContain("Assign manually")
    expect(html).not.toContain("coveragePage")
    expect(render(false, { missing: 0 })).toContain("0 missing review slots")
  })
  it("offers rebalancing next to generation, gated on start", () => {
    expect(render()).toMatch(/disabled=""[^>]*>Rebalance assignments</)
    const html = render(true)
    expect(html).toContain("Rebalance assignments")
    expect(html).not.toMatch(/disabled=""[^>]*>Rebalance assignments</)
  })
  it("gates generation on start", () => {
    expect(render()).toContain("disabled")
    expect(render()).toContain("Start judging before managing assignments")
    expect(render(true)).not.toContain(
      "Start judging before managing assignments"
    )
  })
  it("lists judge progress, least complete first, with counts", () => {
    const html = render()
    expect(html).toContain("Judge progress")
    expect(html.indexOf("slow@example.test")).toBeLessThan(
      html.indexOf("done@example.test")
    )
    expect(html).toContain("Inactive")
    expect(html).toMatch(
      /slow@example\.test.*?<td[^>]*>1<\/td><td[^>]*>2<\/td><td[^>]*>4<\/td><td[^>]*>7<\/td>.*?1 \/ 7/
    )
    expect(html).toContain("3 / 4")
    expect(render(false, data, [])).toContain("No judges have assignments yet")
  })
})
