import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/judging/assignments-actions", () => ({
  addAssignment: vi.fn(),
  getAssignmentCandidates: vi.fn(),
}))
import { ManualAssignmentForm } from "./assignment-controls"
const id = "a0000000-0000-4000-8000-000000000001"
describe("manual assignment controls", () => {
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
