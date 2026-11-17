import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/submission-forms/actions", () => ({
  setJudgesSeeTeam: vi.fn(),
  setMaxTeamSize: vi.fn(),
}))
import { TeamSettings } from "./team-settings"

const eventId = "a0000000-0000-4000-8000-000000000001"

describe("team settings", () => {
  it("shows the stored limit and visibility", () => {
    const html = renderToStaticMarkup(
      createElement(TeamSettings, {
        eventId,
        maxTeamSize: 4,
        judgesSeeTeam: true,
      })
    )
    expect(html).toContain('value="4"')
    expect(html).toContain("checked")
    expect(html).toContain("Judges can see team member names")
  })
  it("leaves the limit blank when unlimited", () => {
    const html = renderToStaticMarkup(
      createElement(TeamSettings, {
        eventId,
        maxTeamSize: null,
        judgesSeeTeam: false,
      })
    )
    expect(html).toContain('value=""')
    expect(html).not.toContain("checked")
  })
})
