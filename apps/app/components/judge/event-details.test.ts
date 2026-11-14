import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { JudgeEventDetails } from "./event-details"
import type { JudgeEvent } from "@/lib/judge-access"
const id = "a0000000-0000-4000-8000-000000000001"
const event: JudgeEvent = {
  event_id: id,
  slug: "fall-2026",
  name: "Fall",
  kind: "sponsor",
  capacity: 20,
  enabled: false,
  judging_started_at: null,
  judging_close_at: "2026-11-21T05:00:00Z",
  tracks: [{ id, name: "Track A", active: true }],
}
describe("judge event landing", () => {
  it("shows role, scopes and waiting state without application onboarding or fake queue counts", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeEventDetails, { event })
    )
    expect(html).toContain("Sponsor judge")
    expect(html).toContain("Track A")
    expect(html).toContain("Judging has not started")
    expect(html).toContain("not implemented")
    expect(html).not.toContain("Submit review")
  })
  it("displays the final included judging minute in Eastern time", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeEventDetails, { event })
    )
    expect(html).toContain("11:59")
    expect(html).toContain("Nov 20")
    expect(html).toContain("America/New_York")
  })
})
