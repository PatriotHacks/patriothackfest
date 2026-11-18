import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(projects)/projects/actions", () => ({
  saveProject: vi.fn(),
  addProjectCollaborator: vi.fn(),
  removeProjectCollaborator: vi.fn(),
  leaveProject: vi.fn(),
}))
vi.mock("@/lib/project-file-actions", () => ({ projectFileUrl: vi.fn() }))
import { ProjectEditor, ProjectReadOnly } from "./editor"
import { ProjectTeam } from "./team"
import type { ProjectDetail } from "@/lib/projects"

const id = "a0000000-0000-4000-8000-000000000001"
const other = "a0000000-0000-4000-8000-000000000002"
const questionId = "b0000000-0000-4000-8000-000000000001"
const detail: ProjectDetail = {
  project: {
    id,
    event_id: id,
    owner_user_id: id,
    name: "Demo",
    status: "draft",
    submitted_at: null,
    updated_at: "2026-11-15T05:00:00Z",
    answers: { [questionId]: "Our <b>story</b>" },
  },
  owner: { user_id: id, full_name: "Participant One" },
  collaborators: [{ user_id: other, full_name: "Participant Two" }],
  max_team_size: null,
  selected_tracks: [],
  available_tracks: [],
  questions: [
    {
      id: questionId,
      label: "What inspired you?",
      help_text: "A paragraph is enough",
      required: true,
      type: "long_text",
      max_length: 500,
      length_unit: "characters" as const,
      options: null,
      validation: null,
    },
  ],
}

const optionA = "c0000000-0000-4000-8000-000000000001"
const optionB = "c0000000-0000-4000-8000-000000000002"
const typed = (n: number) => `b0000000-0000-4000-8000-00000000000${n}`
const base = {
  help_text: null,
  required: false,
  max_length: null,
  length_unit: "characters" as const,
  options: null,
  validation: null,
}
const typedDetail: ProjectDetail = {
  ...detail,
  project: {
    ...detail.project,
    answers: {
      [typed(2)]: optionB,
      [typed(3)]: [optionA, "removed"],
      [typed(4)]: "https://slides.example.test",
      [typed(5)]: {
        path: `${id}/${typed(5)}/${optionA}.pdf`,
        name: "deck.pdf",
        size: 2048,
        type: "application/pdf",
      },
    },
  },
  questions: [
    {
      ...base,
      id: typed(2),
      label: "Primary platform",
      type: "single_choice",
      options: [
        { id: optionA, label: "Web" },
        { id: optionB, label: "Mobile" },
      ],
    },
    {
      ...base,
      id: typed(3),
      label: "Platforms",
      type: "multiple_choice",
      options: [
        { id: optionA, label: "Web" },
        { id: optionB, label: "Mobile" },
      ],
    },
    { ...base, id: typed(4), label: "Slides link", type: "url" },
    {
      ...base,
      id: typed(5),
      label: "Pitch deck",
      required: true,
      type: "file",
      validation: { max_size_mb: 5 },
    },
  ],
}

describe("project form views", () => {
  it("renders explicit draft/save/submit controls and optional tracks", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectEditor, { detail, editable: true })
    )
    expect(html).toContain("Save draft")
    expect(html).toContain("Submit project")
    expect(html).toContain("Sponsor tracks (optional)")
    expect(html).toMatch(
      /Project name<span class="text-destructive" aria-hidden="true"> \*<\/span>/
    )
    expect(html).toContain('aria-required="true"')
  })
  it("offers save changes rather than another submit action for submitted projects", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectEditor, {
        detail: {
          ...detail,
          project: { ...detail.project, status: "submitted" },
        },
        editable: true,
      })
    )
    expect(html).toContain("Save changes")
    expect(html).not.toContain("Submit project")
  })
  it("renders no editable controls for collaborators or closed projects", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectEditor, { detail, editable: false })
    )
    expect(html).toContain("Our &lt;b&gt;story&lt;/b&gt;")
    expect(html).not.toContain("<input")
    expect(html).not.toContain("Submit project")
  })
  it("renders a limited textarea per question with label, help, and required marker", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectEditor, { detail, editable: true })
    )
    expect(html).toMatch(
      /What inspired you\?<span class="text-destructive" aria-hidden="true"> \*<\/span><span class="sr-only"> \(required\)<\/span>/
    )
    expect(html).toContain("A paragraph is enough")
    expect(html).toContain('maxLength="500"')
    expect(html).toContain("16/500 characters")
    expect(html).toContain("Our &lt;b&gt;story&lt;/b&gt;")
  })
  it("counts characters as trimmed code points", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectEditor, {
        detail: {
          ...detail,
          project: {
            ...detail.project,
            answers: { [questionId]: " \u{1F600}\u{1F600} " },
          },
          questions: [{ ...detail.questions[0]!, max_length: 1 }],
        },
        editable: true,
      })
    )
    expect(html).toContain("2/1 character<")
    expect(html).toContain("text-red-700")
  })
  it("counts words for word-limited questions and flags overruns", () => {
    const words = (max_length: number) =>
      renderToStaticMarkup(
        createElement(ProjectEditor, {
          detail: {
            ...detail,
            questions: [
              { ...detail.questions[0]!, max_length, length_unit: "words" },
            ],
          },
          editable: true,
        })
      )
    expect(words(3)).toContain("2/3 words")
    expect(words(3)).toContain('maxLength="10000"')
    expect(words(3)).not.toContain("text-red-700")
    expect(words(1)).toContain("2/1 word<")
    expect(words(1)).toContain("text-red-700")
  })
  it("shows escaped answers in the read-only view", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectReadOnly, { detail })
    )
    expect(html).toContain("What inspired you?")
    expect(html).toContain("Our &lt;b&gt;story&lt;/b&gt;")
    const blank = renderToStaticMarkup(
      createElement(ProjectReadOnly, {
        detail: { ...detail, project: { ...detail.project, answers: {} } },
      })
    )
    expect(blank).toContain("No answer")
  })
  it("renders the project name as the only built-in field", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectEditor, { detail, editable: true })
    )
    expect(html).toContain("Project name")
    expect(html).toContain('value="Demo"')
    expect(html).not.toContain("Short summary")
    expect(html).not.toContain("Repository")
  })
  it("renders typed inputs for choice, URL, and file questions", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectEditor, { detail: typedDetail, editable: true })
    )
    expect(html).toContain("<legend")
    expect(html).toMatch(/type="radio"[^>]*checked=""[^>]*\/>Mobile/)
    expect(html).toMatch(/type="checkbox" checked=""\/>Web/)
    expect(html).toContain("Clear selection")
    expect(html).toContain('type="url"')
    expect(html).toContain('value="https://slides.example.test"')
    expect(html).toContain('accept="application/pdf"')
    expect(html).toContain("PDF only, up to 5 MB")
    expect(html).toContain("View deck.pdf")
    expect(html).toMatch(
      /Pitch deck<span class="text-destructive" aria-hidden="true"> \*<\/span><span class="sr-only"> \(required\)<\/span>/
    )
  })
  it("shows choice labels, links, and files in the read-only view", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectReadOnly, { detail: typedDetail })
    )
    expect(html).toContain("<p>Mobile</p>")
    expect(html).toContain("<li>Web</li>")
    expect(html).not.toContain("removed")
    expect(html).toContain('href="https://slides.example.test"')
    expect(html).toContain("View deck.pdf")
    expect(html).not.toContain(`${id}/${typed(5)}`)
  })
})

describe("project team", () => {
  const team = (
    userId: string,
    editable = true,
    value: ProjectDetail = detail
  ) =>
    renderToStaticMarkup(
      createElement(ProjectTeam, {
        detail: value,
        userId,
        editable,
        eventHref: "/projects/fall-2026",
      })
    )
  it("lets the owner add and remove but not leave", () => {
    const html = team(id)
    expect(html).toContain("Participant One")
    expect(html).toContain("Owner")
    expect(html).toContain("Add teammate")
    expect(html).toContain("Remove Participant Two")
    expect(html).not.toContain("Remove Participant One")
    expect(html).not.toContain("Leave team")
  })
  it("lets a teammate add and leave but not remove", () => {
    const html = team(other)
    expect(html).toContain("Add teammate")
    expect(html).toContain("Leave team")
    expect(html).not.toContain("Remove")
  })
  it("labels blank names and shows the size limit", () => {
    const html = team(id, true, {
      ...detail,
      collaborators: [{ user_id: other, full_name: " " }],
      max_team_size: 2,
    })
    expect(html).toContain("Unnamed participant")
    expect(html).toContain("2 / 2 members")
    expect(html).toContain("This team is full.")
    expect(html).not.toContain("Add teammate")
  })
  it("renders a read-only roster when the project is locked", () => {
    const html = team(other, false)
    expect(html).toContain("Participant Two")
    expect(html).not.toContain("Add teammate")
    expect(html).not.toContain("Leave team")
    expect(html).not.toContain("Remove")
  })
})
