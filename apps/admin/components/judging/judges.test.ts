import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/judging/judges-actions", () => ({
  saveEventJudge: vi.fn(),
  deleteEventJudge: vi.fn(),
}))
import { AddJudgeForm, EventJudgeForm, JudgeRoster } from "./judges"
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
  it("lists judges in a table with tracks, load, status and an edit control", () => {
    const general: JudgeRosterEntry = {
      ...judge,
      id: "a0000000-0000-4000-8000-000000000002",
      email: "general@example.com",
      kind: "general",
      active: true,
      bound: false,
      workload: 0,
      scopes: [],
    }
    const html = renderToStaticMarkup(
      createElement(JudgeRoster, {
        eventId: id,
        tracks,
        judges: [judge, general],
        started: false,
      })
    )
    expect(html).toContain('aria-label="Judges"')
    expect(html).toContain("<td")
    expect(html).toContain("Sponsor A")
    expect(html).toContain("—")
    expect(html).toContain("Inactive · Linked")
    expect(html).toContain("Active · Not linked yet")
    expect(html).toContain('aria-label="Edit person@example.com"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain("Save judge")
  })
  it("offers delete only before judging starts", () => {
    const render = (started: boolean) =>
      renderToStaticMarkup(
        createElement(JudgeRoster, {
          eventId: id,
          tracks,
          judges: [judge],
          started,
        })
      )
    expect(render(false)).toContain('aria-label="Delete person@example.com"')
    expect(render(true)).not.toContain("Delete")
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
