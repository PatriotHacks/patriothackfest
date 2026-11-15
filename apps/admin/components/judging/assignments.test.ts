import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/judging/assignments-actions", () => ({
  generateAssignments: vi.fn(),
  addAssignment: vi.fn(),
  cancelAssignment: vi.fn(),
  reassignAssignment: vi.fn(),
  getAssignmentCandidates: vi.fn(),
}))
import { AssignmentsSection } from "./assignments"
import type { AssignmentOverview } from "@/lib/assignments"
const id = "a0000000-0000-4000-8000-000000000001"
const data: AssignmentOverview = {
  missing: 2,
  coverage_has_more: true,
  assignments_has_more: false,
  assignments: [],
  coverage: [
    {
      project_id: id,
      project_name: "My project",
      track_id: null,
      track_name: null,
      target: 3,
      assigned: 1,
      missing: 2,
    },
  ],
  judges: [
    {
      id,
      email: "judge@example.test",
      active: false,
      capacity: 1,
      workload: 2,
      unfinished: 1,
    },
  ],
}
const render = (started = false, overview = data) =>
  renderToStaticMarkup(
    createElement(AssignmentsSection, {
      eventId: id,
      eventSlug: "event",
      started,
      data: overview,
      filters: { coveragePage: 1, assignmentPage: 1, status: "all" },
      projectsPage: 2,
    })
  )
describe("organizer assignment coverage", () => {
  it("shows shortages, contexts, loads and no optimal promise", () => {
    const html = render()
    expect(html).toContain("2 missing review slots across this event")
    expect(html).toContain("General")
    expect(html).toContain("does not guarantee optimal coverage")
    expect(html).toContain("unfinished assignments need organizer attention")
    expect(html).toContain("Existing work exceeds current capacity")
    expect(html).toContain("coveragePage=2")
    expect(html).toContain("projectsPage=2")
  })
  it("gates generation on start and labels sponsor contexts distinctly", () => {
    expect(render()).toContain("disabled")
    expect(render()).toContain("Start judging before managing assignments")
    const html = render(true, {
      ...data,
      coverage: [
        { ...data.coverage[0]!, track_id: id, track_name: "Sponsor A" },
      ],
    })
    expect(html).toContain("Sponsor: Sponsor A")
    expect(html).not.toContain("Start judging before managing assignments")
  })
  it("renders empty states without fake rows", () => {
    const html = render(false, {
      ...data,
      coverage: [],
      judges: [],
      missing: 0,
    })
    expect(html).toContain("No submitted project contexts")
    expect(html).toContain("No judges configured")
    expect(html).toContain("0 missing review slots")
  })
  it("renders assignment status filters and bounded management navigation", () => {
    const html = render(true, { ...data, assignments_has_more: true })
    expect(html).toContain('name="assignmentStatus"')
    expect(html).toContain("assignmentPage=2")
    expect(html).toContain("No assignments match this page and filter")
    expect(html).toContain("Assign manually")
  })
})
