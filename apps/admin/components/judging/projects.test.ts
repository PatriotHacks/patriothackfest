import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/applications/actions", () => ({
  applicationFileUrl: vi.fn(),
}))
vi.mock("@/app/(admin)/submission-forms/actions", () => ({
  projectFileUrl: vi.fn(),
}))

import { SubmittedProjectsList } from "./projects"
import { SubmittedProjectDetails } from "./project-details"
import type {
  SubmittedProjectDetail,
  SubmittedProjects,
} from "@/lib/organizer-projects"

const id = "a0000000-0000-4000-8000-000000000001"
const event = { slug: "fall-2026", name: "Fall 2026" }
const data: SubmittedProjects = {
  has_more: true,
  projects: [
    {
      id,
      name: "Demo",
      submitted_at: "2026-11-15T05:00:00Z",
      owner: { id, full_name: "Owner" },
      tracks: [{ id, name: "Sponsor A", active: false }],
    },
  ],
}
const detail: SubmittedProjectDetail = {
  project: {
    id,
    event_id: id,
    status: "submitted",
    name: "Demo",
    summary: "Summary",
    description: "Description",
    technologies: "TypeScript",
    repository_url: null,
    demo_url: "https://example.com",
    video_url: null,
    submitted_at: "2026-11-15T05:00:00Z",
    updated_at: "2026-11-15T06:00:00Z",
  },
  owner: { id, full_name: "Owner" },
  collaborators: [{ id, full_name: "Collaborator" }],
  tracks: data.projects[0]!.tracks,
  answers: [
    {
      question_id: id,
      label: "What inspired you?",
      type: "long_text",
      options: null,
      answer: "<b>Bees</b>",
    },
    {
      question_id: id,
      label: "Anything else?",
      type: "short_text",
      options: null,
      answer: null,
    },
  ],
}

describe("organizer submitted projects", () => {
  it("shows summary fields, inactive labels, Eastern dates and event-scoped detail links", () => {
    const html = renderToStaticMarkup(
      createElement(SubmittedProjectsList, {
        eventSlug: event.slug,
        page: 1,
        data,
      })
    )
    for (const text of [
      "Demo",
      "Owner",
      "Sponsor A",
      "(inactive)",
      "America/New_York",
      "Nov 15",
      "View project",
    ])
      expect(html).toContain(text)
    expect(html).toContain(`/submission-forms/projects/${id}?event=fall-2026`)
    expect(html).toContain("projectsPage=1")
    expect(html).toContain(">Next</a>")
    expect(html).not.toContain(">Previous</a>")
  })
  it("preserves pagination and distinguishes an empty later page", () => {
    const html = renderToStaticMarkup(
      createElement(SubmittedProjectsList, {
        eventSlug: event.slug,
        page: 3,
        data: { projects: [], has_more: false },
      })
    )
    expect(html).toContain("No submitted projects on this page")
    expect(html).toContain("projectsPage=2#submitted-projects")
    expect(html).toContain(">First page</a>")
    expect(html).not.toContain(">Next</a>")
  })
  it("renders a clear first-page empty state without inventing failures or totals", () => {
    const html = renderToStaticMarkup(
      createElement(SubmittedProjectsList, {
        eventSlug: event.slug,
        page: 1,
        data: { projects: [], has_more: false },
      })
    )
    expect(html).toContain("No submitted projects for this event yet")
    expect(html).not.toContain("<table")
  })
  it("uses unnamed/general-only fallbacks and escapes submitted names", () => {
    const project = {
      ...data.projects[0]!,
      name: "<script>alert(1)</script>",
      owner: { id, full_name: null },
      tracks: [],
    }
    const html = renderToStaticMarkup(
      createElement(SubmittedProjectsList, {
        eventSlug: event.slug,
        page: 1,
        data: { projects: [project], has_more: false },
      })
    )
    expect(html).toContain("Unnamed participant")
    expect(html).toContain("None (general judging only)")
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain("&lt;script&gt;")
  })
  it("renders complete read-only detail, safe new-tab links, and context-preserving back navigation", () => {
    const html = renderToStaticMarkup(
      createElement(SubmittedProjectDetails, { event, detail, page: 2 })
    )
    for (const text of [
      "Summary",
      "Description",
      "TypeScript",
      "Owner",
      "Collaborator",
      "Sponsor A",
      "Submitted",
      "Last updated",
      "Read-only organizer view",
      "What inspired you?",
      "&lt;b&gt;Bees&lt;/b&gt;",
      "No answer",
    ])
      expect(html).toContain(text)
    expect(html).toContain("projectsPage=2#submitted-projects")
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).not.toContain("<form")
    expect(html).not.toContain("<input")
    expect(html).not.toContain("<button")
  })
  it("never renders project text as HTML or links unsafe legacy URLs", () => {
    const unsafe = {
      ...detail,
      project: {
        ...detail.project,
        description: '<img src=x onerror="alert(1)">',
        demo_url: "javascript:alert(1)",
      },
    }
    const html = renderToStaticMarkup(
      createElement(SubmittedProjectDetails, { event, detail: unsafe, page: 1 })
    )
    expect(html).toContain("&lt;img")
    expect(html).not.toContain("<img src=x")
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain("No usable HTTP(S) project links")
  })
  it("renders typed answers as labels, safe links, and signed file links", () => {
    const optionA = "c0000000-0000-4000-8000-000000000001"
    const optionB = "c0000000-0000-4000-8000-000000000002"
    const options = [
      { id: optionA, label: "Web" },
      { id: optionB, label: "Mobile" },
    ]
    const base = { question_id: id, options: null }
    const html = renderToStaticMarkup(
      createElement(SubmittedProjectDetails, {
        event,
        page: 1,
        detail: {
          ...detail,
          answers: [
            {
              ...base,
              label: "Primary",
              type: "single_choice",
              options,
              answer: optionB,
            },
            {
              ...base,
              label: "Platforms",
              type: "multiple_choice",
              options,
              answer: [optionA, "removed"],
            },
            {
              ...base,
              label: "Slides",
              type: "url",
              answer: "https://slides.example.test/deck",
            },
            {
              ...base,
              label: "Legacy",
              type: "url",
              answer: "javascript:alert(1)",
            },
            {
              ...base,
              label: "Deck",
              type: "file",
              answer: {
                path: `${id}/${id}/${id}.pdf`,
                name: "deck.pdf",
                size: 1,
                type: "application/pdf",
              },
            },
          ],
        },
      })
    )
    expect(html).toContain("<p>Mobile</p>")
    expect(html).toContain("<li>Web</li>")
    expect(html).not.toContain("removed")
    expect(html).toContain('href="https://slides.example.test/deck"')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain("View deck.pdf")
    expect(html).not.toContain(`${id}/${id}/${id}.pdf`)
  })
})
