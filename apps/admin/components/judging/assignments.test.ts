import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/judging/assignments-actions", () => ({
  generateAssignments: vi.fn(),
  previewRebalanceAssignments: vi.fn(),
  rebalanceAssignments: vi.fn(),
  addAssignment: vi.fn(),
  getAssignmentCandidates: vi.fn(),
}))
import { AssignmentsSection } from "./assignments"
import type { AssignmentOverview } from "@/lib/assignments"
const id = "a0000000-0000-4000-8000-000000000001"
const data: AssignmentOverview = {
  missing: 2,
  coverage_has_more: true,
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
}
const render = (started = false, overview = data) =>
  renderToStaticMarkup(
    createElement(AssignmentsSection, {
      eventId: id,
      eventSlug: "event",
      started,
      data: overview,
      filters: { coveragePage: 1 },
      projectsPage: 2,
    })
  )
describe("organizer assignment coverage", () => {
  it("shows shortages, contexts and no optimal promise", () => {
    const html = render()
    expect(html).toContain("2 missing review slots across this event")
    expect(html).toContain("General")
    expect(html).toContain("does not guarantee optimal coverage")
    expect(html).toContain("coveragePage=2")
    expect(html).toContain("projectsPage=2")
  })
  it("offers rebalancing next to generation, gated on start", () => {
    expect(render()).toMatch(/disabled=""[^>]*>Rebalance assignments</)
    const html = render(true)
    expect(html).toContain("Rebalance assignments")
    expect(html).not.toMatch(/disabled=""[^>]*>Rebalance assignments</)
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
      missing: 0,
    })
    expect(html).toContain("No submitted project contexts")
    expect(html).toContain("0 missing review slots")
  })
  it("offers manual assignment for missing slots without a per-assignment table", () => {
    const html = render(true)
    expect(html).toContain("Assign manually")
    expect(html).not.toContain("Manage assignments")
    expect(html).not.toContain('name="assignmentStatus"')
  })
  it("retains result context/pages through assignment links and status forms", () => {
    const html = renderToStaticMarkup(
      createElement(AssignmentsSection, {
        eventId: id,
        eventSlug: "event",
        started: false,
        data,
        filters: {
          coveragePage: 2,
          projectId: id,
        },
        projectsPage: 3,
        resultsQuery: { resultsTrack: id, resultsPage: "4" },
      })
    )
    expect(html).toContain(`resultsTrack=${id}&amp;resultsPage=4`)
    expect(html).toContain("Show all projects")
  })
})
