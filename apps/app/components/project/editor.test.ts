import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(projects)/projects/actions", () => ({
  saveProject: vi.fn(),
  addProjectCollaborator: vi.fn(),
  removeProjectCollaborator: vi.fn(),
}))
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
      max_length: 500,
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
})
