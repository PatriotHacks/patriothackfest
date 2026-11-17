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
  type: "long_text" as const,
  max_length: 2000,
  options: null,
  validation: null,
  answered: false,
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
      "Answer type",
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
    expect(html).toContain("No project questions for this event")
  })
  it("renders options for choice questions and file limits for uploads", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectQuestions, {
        eventId,
        questions: [
          {
            ...question,
            type: "multiple_choice",
            max_length: null,
            options: [{ id: eventId, label: "Web" }],
          },
          {
            ...question,
            id: eventId,
            type: "file",
            max_length: null,
            validation: { max_size_mb: 4 },
          },
        ],
        locked: false,
      })
    )
    for (const text of ['value="Web"', "Add option", "PDF only", 'value="4"'])
      expect(html).toContain(text)
    expect(html.split("Maximum characters")).toHaveLength(2)
  })
  it("locks the type of answered questions", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectQuestions, {
        eventId,
        questions: [{ ...question, answered: true }],
        locked: false,
      })
    )
    expect(html).toContain("Type locked: this question has answers")
  })
  it("renders the judge visibility switch with its saved value", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeVisibilityToggle, { eventId, enabled: true })
    )
    expect(html).toContain("Judges can see question answers")
    expect(html).toContain("checked")
  })
})
