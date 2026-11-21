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
import { assignment, criteria, event } from "@/lib/judge-review-form.test"
const position = {
  number: 3,
  total: 12,
  previous: "/judge/fall-2026/previous",
  next: null,
}
const render = (props: Partial<Parameters<typeof JudgeScorecardForm>[0]>) =>
  renderToStaticMarkup(
    createElement(JudgeScorecardForm, {
      event,
      criteria,
      assignment,
      position,
      ...props,
    })
  )
describe("scorecard rendering", () => {
  it("shows every criterion, unset sliders and gated submission", () => {
    const html = render({})
    for (const text of [
      "Criterion A",
      "Criterion B",
      "2.5 / 5",
      "Not scored",
      "Save draft",
      "Submit &amp; next",
      ">saved</textarea>",
      "Only organizers see this.",
      "Score every criterion",
      "Project 3 of 12",
      'href="/judge/fall-2026/previous"',
      "America/New_York",
    ])
      expect(html).toContain(text)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Submit &amp; next/)
  })
  it("enables submit and shows the average when every criterion is scored", () => {
    const html = render({
      assignment: {
        ...assignment,
        scores: { ...assignment.scores, [criteria[1]!.id]: 4 },
      },
    })
    expect(html).toContain("3.25 / 5")
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Submit &amp; next/)
  })
  it("keeps submitted reviews editable while judging is open", () => {
    const html = render({
      assignment: {
        ...assignment,
        scores: { [criteria[0]!.id]: 3, [criteria[1]!.id]: 4 },
        submitted_at: "date",
      },
    })
    expect(html).toContain("Save changes")
    expect(html).not.toContain("Save draft")
    expect(html).not.toContain("<fieldset disabled")
  })
  it("locks scoring after judging closes", () => {
    const html = render({
      event: { ...event, judging_close_at: "2000-01-01T00:00:00Z" },
    })
    expect(html).toContain("<fieldset disabled")
    expect(html).toContain("Check for an extension")
    expect(html).not.toContain("Submit &amp; next")
  })
  it("explains a missing rubric", () => {
    expect(render({ criteria: [] })).toContain(
      "Scoring criteria have not been set up"
    )
  })
})
