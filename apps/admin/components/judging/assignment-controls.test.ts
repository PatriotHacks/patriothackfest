import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/judging/assignments-actions", () => ({
  addAssignment: vi.fn(),
  cancelAssignment: vi.fn(),
  reassignAssignment: vi.fn(),
  getAssignmentCandidates: vi.fn(),
}))
import { AssignmentControls, ManualAssignmentForm } from "./assignment-controls"
import type { AssignmentOverview } from "@/lib/assignments"
const id = "a0000000-0000-4000-8000-000000000001"
const assignment: AssignmentOverview["assignments"][number] = {
  id,
  project_id: id,
  project_name: "Project",
  judge_id: id,
  judge_email: "judge@example.test",
  judge_active: true,
  track_id: null,
  track_name: null,
  status: "untouched",
}
const render = (status = assignment.status, started = true) =>
  renderToStaticMarkup(
    createElement(AssignmentControls, {
      eventId: id,
      assignment: { ...assignment, status },
      started,
    })
  )
describe("manual assignment controls", () => {
  it("offers cancellation and replacement only for untouched started work", () => {
    expect(render()).toContain("Choose replacement judge")
    expect(render()).toContain("Cancel untouched assignment")
    expect(render("untouched", false)).not.toContain(
      "Cancel untouched assignment"
    )
  })
  it("never offers actions for protected or cancelled work", () => {
    for (const status of ["in_progress", "submitted", "cancelled"] as const) {
      const html = render(status)
      expect(html).not.toContain("<button")
      expect(html).toContain(
        status === "cancelled" ? "never regenerated" : "Protected review"
      )
    }
  })
  it("loads eligible choices on demand rather than showing fake candidates", () => {
    const html = renderToStaticMarkup(
      createElement(ManualAssignmentForm, {
        eventId: id,
        projectId: id,
        trackId: null,
      })
    )
    expect(html).toContain("Assign manually")
    expect(html).not.toContain("<option")
    expect(html).toContain('role="status"')
  })
})
