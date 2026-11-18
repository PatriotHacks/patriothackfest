import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/project-submissions/actions", () => ({
  projectFileUrl: vi.fn(),
}))

import { ProjectsList } from "./projects-list"
import { ProjectDetails } from "./project-details"
import type { EventProjects, ProjectDetail } from "@/lib/organizer-projects"

const id = "a0000000-0000-4000-8000-000000000001"
const draftId = "a0000000-0000-4000-8000-000000000002"
const event = { slug: "fall-2026", name: "Fall 2026" }
const all = { status: null, page: 1 }
const data: EventProjects = {
  has_more: true,
  required_count: 3,
  counts: { draft: 1, submitted: 1, withdrawn: 0 },
  projects: [
    {
      id,
      name: "Demo",
      status: "submitted",
      submitted_at: "2026-11-15T05:00:00Z",
      updated_at: "2026-11-16T05:00:00Z",
      owner: { id, full_name: "Owner" },
      answered_count: 3,
    },
    {
      id: draftId,
      name: "Sketch",
      status: "draft",
      submitted_at: null,
      updated_at: "2026-11-14T05:00:00Z",
      owner: { id, full_name: "Drafter" },
      answered_count: 1,
    },
  ],
}
const tracks = [{ id, name: "Sponsor A", active: false }]
const detail: ProjectDetail = {
  project: {
    id,
    event_id: id,
    status: "submitted",
    name: "Demo",
    submitted_at: "2026-11-15T05:00:00Z",
    updated_at: "2026-11-15T06:00:00Z",
  },
  owner: { id, full_name: "Owner" },
  collaborators: [{ id, full_name: "Collaborator" }],
  tracks,
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
const empty: EventProjects = {
  projects: [],
  has_more: false,
  required_count: 0,
  counts: { draft: 0, submitted: 0, withdrawn: 0 },
}

describe("organizer project list", () => {
  it("shows status badges, labelled times, completion, and event-scoped detail links", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectsList, { eventSlug: event.slug, query: all, data })
    )
    for (const text of [
      "Demo",
      "Sketch",
      "Owner",
      "Draft",
      "Submitted",
      "Submitted <time",
      "Updated <time",
      "Nov 15",
      "Nov 14",
      "3 / 3 required",
      "1 / 3 required",
    ])
      expect(html).toContain(text)
    expect(html).not.toContain("Nov 16")
    for (const [projectId, name] of [
      [id, "Demo"],
      [draftId, "Sketch"],
    ])
      expect(html).toContain(
        `href="/project-submissions/${projectId}?event=fall-2026&amp;projectsPage=1">${name}</a>`
      )
    expect(html).not.toContain("View project")
    expect(html).toContain(">Next</a>")
    expect(html).not.toContain(">Previous</a>")
  })
  it("filters by status with counts and hides withdrawn when there are none", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectsList, {
        eventSlug: event.slug,
        query: { status: "draft", page: 1 },
        data,
      })
    )
    expect(html).toMatch(
      /aria-current="page"[^>]*href="\/project-submissions\?event=fall-2026&amp;status=draft&amp;projectsPage=1"/
    )
    expect(html).toContain(
      'href="/project-submissions?event=fall-2026&amp;projectsPage=1"'
    )
    expect(html).toContain("status=submitted")
    expect(html).not.toContain("Withdrawn")
    expect(html).toContain("status=draft&amp;projectsPage=2")
  })
  it("offers the withdrawn filter only when withdrawn projects exist", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectsList, {
        eventSlug: event.slug,
        query: all,
        data: { ...empty, counts: { draft: 0, submitted: 0, withdrawn: 2 } },
      })
    )
    expect(html).toContain("Withdrawn")
    expect(html).toContain("status=withdrawn")
  })
  it("preserves pagination and distinguishes an empty later page", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectsList, {
        eventSlug: event.slug,
        query: { status: "submitted", page: 3 },
        data: empty,
      })
    )
    expect(html).toContain("No projects on this page")
    expect(html).toContain("status=submitted&amp;projectsPage=2")
    expect(html).toContain(">First page</a>")
    expect(html).not.toContain(">Next</a>")
  })
  it("renders a clear first-page empty state", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectsList, {
        eventSlug: event.slug,
        query: all,
        data: empty,
      })
    )
    expect(html).toContain("No projects match this filter yet")
    expect(html).not.toContain("<table")
  })
  it("uses unnamed fallbacks, escapes names, and handles events without required questions", () => {
    const project = {
      ...data.projects[0]!,
      name: "<script>alert(1)</script>",
      owner: { id, full_name: null },
    }
    const html = renderToStaticMarkup(
      createElement(ProjectsList, {
        eventSlug: event.slug,
        query: all,
        data: { ...empty, projects: [project] },
      })
    )
    expect(html).toContain("Unnamed participant")
    expect(html).toContain("None required")
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain("&lt;script&gt;")
  })
})

describe("organizer project detail", () => {
  it("renders complete read-only detail and context-preserving back navigation", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectDetails, {
        event,
        detail,
        query: { status: "submitted", page: 2 },
      })
    )
    for (const text of [
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
    expect(html).toContain(
      'href="/project-submissions?event=fall-2026&amp;status=submitted&amp;projectsPage=2"'
    )
    expect(html).toContain("Back to project submissions")
    expect(html).not.toContain("Project links")
    expect(html).not.toContain("<form")
    expect(html).not.toContain("<input")
    expect(html).not.toContain("<button")
  })
  it("opens drafts read-only with a draft badge and no submission time", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectDetails, {
        event,
        query: all,
        detail: {
          ...detail,
          project: { ...detail.project, status: "draft", submitted_at: null },
        },
      })
    )
    expect(html).toContain(">Draft</span>")
    expect(html).toContain("Read-only organizer view of a draft")
    expect(html).toContain("What inspired you?")
    expect(html).toContain("Last updated")
    expect(html).not.toContain(">Submitted</dt>")
    expect(html).not.toContain("<form")
    expect(html).not.toContain("<input")
  })
  it("never renders the project name as HTML", () => {
    const unsafe = {
      ...detail,
      project: { ...detail.project, name: '<img src=x onerror="alert(1)">' },
    }
    const html = renderToStaticMarkup(
      createElement(ProjectDetails, { event, detail: unsafe, query: all })
    )
    expect(html).toContain("&lt;img")
    expect(html).not.toContain("<img src=x")
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
      createElement(ProjectDetails, {
        event,
        query: all,
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
