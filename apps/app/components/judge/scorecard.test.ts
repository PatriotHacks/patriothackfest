import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/app/(judge)/judge/actions", () => ({
  saveJudgeReview: vi.fn(),
  continueJudgeQueue: vi.fn(),
  checkJudgeReview: vi.fn(),
}))
import { JudgeScorecardForm } from "./scorecard"
import type { JudgeEvent } from "@/lib/judge-access"
import type { JudgeScorecard } from "@/lib/judge-reviews"
const id = "a0000000-0000-4000-8000-000000000001"
const event: JudgeEvent = {
  event_id: id,
  slug: "fall-2026",
  name: "Fall",
  kind: "general",
  capacity: 20,
  enabled: true,
  judging_started_at: "2026-11-18T00:00:00Z",
  judging_close_at: "2026-11-21T05:00:00Z",
  tracks: [],
}
const assignment: JudgeScorecard = {
  id,
  track_id: null,
  track_name: null,
  creativity_score: 4,
  technical_score: null,
  impact_score: null,
  presentation_score: null,
  notes: "Saved notes",
  submitted_at: null,
  total_score: null,
}
describe("scorecard rendering", () => {
  it("shows partial drafts, all rubric criteria and explicit persistence controls", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeScorecardForm, { event, assignment })
    )
    for (const text of [
      "Creativity",
      "Technical execution",
      "Impact/usefulness",
      "Presentation/demo",
      "Save draft",
      "Submit &amp; next",
      "Saved notes",
      "Check deadline / extension",
      "America/New_York",
    ])
      expect(html).toContain(text)
    expect(html).toContain('value="4" selected=""')
    expect(html).not.toContain("<fieldset disabled")
  })
  it("renders submitted scorecards read-only and never offers another save", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeScorecardForm, {
        event,
        assignment: {
          ...assignment,
          technical_score: 3,
          impact_score: 3,
          presentation_score: 3,
          total_score: 13,
          submitted_at: "date",
        },
      })
    )
    expect(html).toContain("<fieldset disabled")
    expect(html).toContain("Total: 13 / 20")
    expect(html).not.toContain("Save draft")
    expect(html).not.toContain("Submit &amp; next")
  })
})
