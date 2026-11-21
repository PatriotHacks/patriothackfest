import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/judging/criteria-actions", () => ({
  saveJudgingCriterion: vi.fn(),
  deleteJudgingCriterion: vi.fn(),
  reorderJudgingCriteria: vi.fn(),
}))
import { JudgingCriteria } from "./criteria"
const id = "a0000000-0000-4000-8000-000000000001"
const criteria = [
  { id, name: "Criterion A", description: "About A" },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    name: "Criterion B",
    description: "",
  },
]
describe("rubric editor", () => {
  it("edits, reorders and deletes criteria before judging starts", () => {
    const html = renderToStaticMarkup(
      createElement(JudgingCriteria, { eventId: id, criteria, locked: false })
    )
    for (const text of [
      "Criterion A",
      "About A",
      "Move down",
      "Delete",
      "Add criterion",
    ])
      expect(html).toContain(text)
  })
  it("is read-only once judging starts", () => {
    const html = renderToStaticMarkup(
      createElement(JudgingCriteria, { eventId: id, criteria, locked: true })
    )
    expect(html).toContain("Criterion A")
    expect(html).toContain("locked because judging has started")
    expect(html).not.toContain("Add criterion")
    expect(html).not.toContain("<input")
  })
  it("asks for criteria when the rubric is empty", () => {
    const html = renderToStaticMarkup(
      createElement(JudgingCriteria, {
        eventId: id,
        criteria: [],
        locked: false,
      })
    )
    expect(html).toContain("Add at least one before starting judging")
  })
})
