import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/submission-forms/actions", () => ({
  archiveProjectQuestion: vi.fn(),
  reorderProjectQuestions: vi.fn(),
  saveProjectQuestion: vi.fn(),
  setJudgesSeeAnswers: vi.fn(),
}))
import { JudgeVisibilityToggle } from "./judge-visibility"
import { ProjectQuestions } from "./questions"

const eventId = "e0000000-0000-4000-8000-000000000001"
const question = {
  id: "d0000000-0000-4000-8000-000000000001",
  event_id: eventId,
  position: 1,
  label: "What inspired you?",
  help_text: "One paragraph",
  required: true,
  max_length: 2000,
  archived_at: null,
  created_at: "2026-11-15T05:00:00Z",
  updated_at: "2026-11-15T05:00:00Z",
}

describe("project question editor", () => {
  it("renders editable questions with ordering, archive, and add controls", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectQuestions, {
        eventId,
        questions: [question, { ...question, id: eventId, label: "Second" }],
        locked: false,
      })
    )
    for (const text of [
      'value="What inspired you?"',
      "One paragraph",
      'value="2000"',
      "Required to submit",
      "Move up",
      "Move down",
      "Archive",
      "Add question",
    ])
      expect(html).toContain(text)
  })
  it("locks every question control after judging starts", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectQuestions, {
        eventId,
        questions: [question],
        locked: true,
      })
    )
    expect(html).toContain("Questions are locked because judging has started")
    expect(html).toContain("disabled")
    expect(html).not.toContain("Add question")
    expect(html).not.toContain("Archive")
    expect(html).not.toContain("Move up")
  })
  it("shows an empty state", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectQuestions, { eventId, questions: [], locked: false })
    )
    expect(html).toContain("No paragraph questions for this event")
  })
  it("renders the judge visibility switch with its saved value", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeVisibilityToggle, { eventId, enabled: true })
    )
    expect(html).toContain("Judges can see question answers")
    expect(html).toContain("checked")
  })
})
