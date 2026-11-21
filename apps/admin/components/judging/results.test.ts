import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ResultsSection } from "./results"
import type { JudgingResults } from "@/lib/judging-results"

const id = "a0000000-0000-4000-8000-000000000001"
const trackId = "b0000000-0000-4000-8000-000000000001"
const data: JudgingResults = {
  track_id: null,
  track_name: null,
  target: 3,
  has_more: true,
  projects: [
    {
      project_id: id,
      project_name: "<Project>",
      completed: 1,
      average_score: 4.125,
      insufficient_coverage: true,
      tied: true,
    },
    {
      project_id: `${id.slice(0, -1)}2`,
      project_name: "Unscored",
      completed: 0,
      average_score: null,
      insufficient_coverage: true,
      tied: false,
    },
    {
      project_id: `${id.slice(0, -1)}3`,
      project_name: "Complete",
      completed: 4,
      average_score: 3,
      insufficient_coverage: false,
      tied: false,
    },
  ],
}
const props = {
  eventSlug: "event & one",
  tracks: [
    { id: trackId, name: "General", active: true },
    { id, name: "Inactive", active: false },
  ],
  filters: { trackId: null, page: 1 },
  data,
  projectsPage: 4,
  otherQuery: { assignmentStatus: "submitted", assignmentPage: "2" },
}
const render = (
  overrides: Partial<Parameters<typeof ResultsSection>[0]> = {}
) =>
  renderToStaticMarkup(
    createElement(ResultsSection, { ...props, ...overrides })
  )

describe("organizer results section", () => {
  it("renders accessible contextual results, coverage and ties without winner selection", () => {
    const html = render()
    for (const text of [
      'id="results"',
      'aria-labelledby="results-heading"',
      'aria-label="Judging results"',
      "Results context",
      "General results",
      "Completed reviews / target",
      "1 / 3",
      "0 / 3",
      "4 / 3",
      "4.13 / 5",
      "No reviews",
      "Insufficient coverage",
      "Tied average",
      "Exceeds current target",
      "Winner decisions are manual",
      "unrounded averages",
      "including other pages",
    ])
      expect(html).toContain(text)
    expect(html).not.toContain("0.00 / 5")
    expect(html).toContain("&lt;Project&gt;")
    expect(html).not.toContain("<Project>")
    expect(html).toContain(
      `/project-submissions/${id}?event=event+%26+one&amp;projectsPage=4`
    )
  })
  it("selects General/active sponsor tracks and resets results page on context submit", () => {
    const html = render({
      data: { ...data, track_id: trackId, track_name: "General" },
      filters: { trackId, page: 2 },
    })
    expect(html).toContain(`value="${trackId}" selected=""`)
    expect(html).toContain("Sponsor: General")
    expect(html).not.toContain("Inactive")
    expect(html).toContain('action="/judging#results"')
    expect(html).toContain('name="assignmentStatus" value="submitted"')
    expect(html).not.toContain('name="resultsPage"')
    expect(html).toContain('name="projectsPage" value="4"')
  })
  it("preserves context and unrelated pages in bounded pagination", () => {
    const html = render({
      filters: { trackId, page: 2 },
      data: { ...data, track_id: trackId, track_name: "Sponsor" },
    })
    expect(html).toContain('aria-label="Results pages"')
    expect(html).toContain("First page")
    expect(html).toContain("Previous")
    expect(html).toContain("Next")
    expect(html).toContain(`resultsTrack=${trackId}&amp;resultsPage=3#results`)
    expect(html).toContain(
      "assignmentStatus=submitted&amp;assignmentPage=2&amp;projectsPage=4"
    )
  })
  it("shows honest first/later-page and unconfigured empty states", () => {
    const empty = { ...data, projects: [], has_more: false }
    expect(render({ data: empty })).toContain(
      "No submitted projects in this results context yet"
    )
    const later = render({ data: empty, filters: { trackId: null, page: 9 } })
    expect(later).toContain("No results on this page")
    expect(later).toContain("First page")
    expect(later).not.toContain(">Next<")
    const unconfigured = render({ data: { ...empty, target: null } })
    expect(unconfigured).toContain("Save event settings")
    expect(unconfigured).not.toContain('aria-label="Results pages"')
  })
  it("explains invalid/stale context without displaying General results", () => {
    const html = render({ invalidContext: true, data: null })
    expect(html).toContain('role="alert"')
    expect(html).toContain("Results context unavailable")
    expect(html).toContain("Unavailable context")
    expect(html).not.toContain("General results")
    expect(html).not.toContain('aria-label="Judging results"')
  })
})
