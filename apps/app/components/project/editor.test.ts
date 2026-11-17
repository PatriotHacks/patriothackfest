import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(projects)/projects/actions", () => ({
  saveProject: vi.fn(),
  addProjectCollaborator: vi.fn(),
  removeProjectCollaborator: vi.fn(),
}))
vi.mock("@/lib/project-file-actions", () => ({ projectFileUrl: vi.fn() }))
import { ProjectEditor, ProjectReadOnly } from "./editor"
import { ProjectCollaborators } from "./collaborators"
import type { ProjectDetail } from "@/lib/projects"

const id = "a0000000-0000-4000-8000-000000000001"
const questionId = "b0000000-0000-4000-8000-000000000001"
const detail: ProjectDetail = {
  project: {
    id,
    event_id: id,
    owner_user_id: id,
    name: "Demo",
    summary: "Summary",
    description: "Description",
    technologies: "",
    repository_url: null,
    demo_url: "https://example.com",
    video_url: null,
    status: "draft",
    submitted_at: null,
    updated_at: "2026-11-15T05:00:00Z",
    answers: { [questionId]: "Our <b>story</b>" },
  },
  collaborators: [{ user_id: id, full_name: "Participant Two" }],
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
    expect(html).toContain("Summary")
    expect(html).not.toContain("<input")
    expect(html).not.toContain("Submit project")
    const roster = renderToStaticMarkup(
      createElement(ProjectCollaborators, { detail, editable: false })
    )
    expect(roster).toContain("Participant Two")
    expect(roster).not.toContain("Add collaborator")
    expect(roster).not.toContain("Remove")
  })
  it("renders a limited textarea per question with label, help, and required marker", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectEditor, { detail, editable: true })
    )
    expect(html).toContain("What inspired you? (required)")
    expect(html).toContain("A paragraph is enough")
    expect(html).toContain('maxLength="500"')
    expect(html).toContain("16/500 characters")
    expect(html).toContain("Our &lt;b&gt;story&lt;/b&gt;")
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
    expect(words(1)).toContain("2/1 words")
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
  it("does not render unsafe URLs as clickable links", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectReadOnly, {
        detail: {
          ...detail,
          project: { ...detail.project, demo_url: "javascript:alert(1)" },
        },
      })
    )
    expect(html).not.toContain("javascript:")
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
    expect(html).toContain("Pitch deck (required)")
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
