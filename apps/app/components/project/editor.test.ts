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
  },
  collaborators: [{ user_id: id, full_name: "Participant Two" }],
  selected_tracks: [],
  available_tracks: [],
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
