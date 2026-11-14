import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/judging/judges-actions", () => ({
  saveEventJudge: vi.fn(),
}))
import { EventJudgeForm } from "./judges"
import type { JudgeRosterEntry } from "@/lib/judges"
const id = "a0000000-0000-4000-8000-000000000001"
describe("judge admin form", () => {
  it("renders default capacity and active/general controls without invitations", () => {
    const html = renderToStaticMarkup(
      createElement(EventJudgeForm, { eventId: id, tracks: [] })
    )
    expect(html).toContain("Add judge")
    expect(html).toContain('value="20"')
    expect(html).toContain("Active — uncheck and save to deactivate")
    expect(html).not.toContain("Send invitation")
  })
  it("keeps referenced inactive sponsor scopes visible and protected", () => {
    const judge: JudgeRosterEntry = {
      id,
      event_id: id,
      email: "person@example.com",
      kind: "sponsor",
      active: false,
      capacity: 20,
      bound: true,
      has_assignments: true,
      workload: 1,
      scopes: [{ id, name: "Sponsor A", active: false, referenced: true }],
    }
    const html = renderToStaticMarkup(
      createElement(EventJudgeForm, {
        eventId: id,
        tracks: [{ id, name: "Sponsor A", active: false }],
        judge,
      })
    )
    expect(html).toContain("Inactive")
    expect(html).toContain("Account linked")
    expect(html).toContain("required by existing assignments")
    expect(html).toContain("disabled")
  })
})
