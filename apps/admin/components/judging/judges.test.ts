import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/judging/judges-actions", () => ({
  saveEventJudge: vi.fn(),
}))
import { AddJudgeForm, EventJudgeForm } from "./judges"
import type { JudgeRosterEntry } from "@/lib/judges"
const id = "a0000000-0000-4000-8000-000000000001"
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
const tracks = [{ id, name: "Sponsor A", active: false }]
describe("judge admin form", () => {
  it("renders a compact add form with default capacity and no active toggle or invitations", () => {
    const html = renderToStaticMarkup(
      createElement(AddJudgeForm, { eventId: id, tracks: [] })
    )
    expect(html).toContain("Add judge")
    expect(html).toContain('value="20"')
    expect(html).toContain('<option value="general" selected="">General')
    expect(html).not.toContain("Active")
    expect(html).not.toContain("Sponsor tracks")
    expect(html).not.toContain("Send invitation")
  })
  it("keeps referenced inactive sponsor scopes visible and protected when editing", () => {
    const html = renderToStaticMarkup(
      createElement(EventJudgeForm, { eventId: id, tracks, judge })
    )
    expect(html).toContain("Active — uncheck and save to deactivate")
    expect(html).toContain("linked to an account")
    expect(html).toContain("Judge type and assignment-referenced tracks")
    expect(html).toContain("required by existing assignments")
    expect(html).toMatch(/<select[^>]*disabled/)
    expect(html).toContain(
      '<input type="checkbox" disabled="" checked=""/>Sponsor A'
    )
  })
})
