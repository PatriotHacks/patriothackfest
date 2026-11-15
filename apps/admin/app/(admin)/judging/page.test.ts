import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAdmin,
  from,
  rpc,
  getSubmittedProjects,
  getAssignmentOverview,
  getJudgingResults,
  redirect,
} = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  getSubmittedProjects: vi.fn(),
  getAssignmentOverview: vi.fn(),
  getJudgingResults: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("Redirect to forms")
  }),
}))
vi.mock("@/lib/admin", () => ({ getAdmin }))
vi.mock("@/lib/organizer-project-data", () => ({ getSubmittedProjects }))
vi.mock("@/lib/assignment-data", () => ({ getAssignmentOverview }))
vi.mock("@/lib/judging-results-data", () => ({ getJudgingResults }))
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/components/judging/settings-form", () => ({
  CompetitionSettingsForm: () => "Existing settings",
}))
vi.mock("@/components/judging/track-form", () => ({
  CompetitionTrackForm: () => "Existing track settings",
}))
vi.mock("@/components/judging/judges", () => ({
  JudgeRoster: () => "Existing judge roster",
}))
vi.mock("@/app/(admin)/judging/assignments-actions", () => ({
  generateAssignments: vi.fn(),
  addAssignment: vi.fn(),
  cancelAssignment: vi.fn(),
  reassignAssignment: vi.fn(),
  getAssignmentCandidates: vi.fn(),
}))
import JudgingPage from "./page"

const id = "a0000000-0000-4000-8000-000000000001"
const otherId = "a0000000-0000-4000-8000-000000000002"
const trackId = "b0000000-0000-4000-8000-000000000001"
const inactiveId = "b0000000-0000-4000-8000-000000000002"
const event = {
  id,
  slug: "fall-2026",
  name: "Fall",
  starts_at: null,
  ends_at: null,
}
const tracks = [
  { id: trackId, name: "Sponsor A", active: true },
  { id: inactiveId, name: "Inactive", active: false },
]
const results = {
  track_id: null,
  track_name: null,
  target: 3,
  projects: [],
  has_more: false,
}
let responses: Record<
  string,
  { data: unknown; error: { message: string } | null }
>
const page = (query: Record<string, string | string[] | undefined> = {}) =>
  JudgingPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(query),
  })

beforeEach(() => {
  vi.clearAllMocks()
  responses = {
    events: {
      data: [event, { ...event, id: otherId, slug: "other", name: "Other" }],
      error: null,
    },
    event_competition_settings: {
      data: { judging_started_at: "2026-11-15T05:00:00Z" },
      error: null,
    },
    competition_tracks: { data: tracks, error: null },
  }
  from.mockImplementation((table: string) => {
    const result = responses[table]
    return Object.assign(Promise.resolve(result), {
      select() {
        return this
      },
      eq() {
        return this
      },
      order() {
        return this
      },
      maybeSingle() {
        return Promise.resolve(result)
      },
    })
  })
  getAdmin.mockResolvedValue({ level: "organizer", supabase: { from, rpc } })
  rpc.mockResolvedValue({ data: [], error: null })
  getSubmittedProjects.mockResolvedValue({ projects: [], has_more: true })
  getAssignmentOverview.mockResolvedValue({
    missing: 0,
    coverage: [],
    assignments: [],
    judges: [],
    coverage_has_more: true,
    assignments_has_more: true,
  })
  getJudgingResults.mockResolvedValue(results)
})

describe("organizer judging page results integration", () => {
  it("redirects reviewer before any competition reads", async () => {
    getAdmin.mockResolvedValue({ level: "reviewer" })
    await expect(page()).rejects.toThrow("Redirect to forms")
    expect(redirect).toHaveBeenCalledWith("/forms")
    expect(from).not.toHaveBeenCalled()
    expect(getJudgingResults).not.toHaveBeenCalled()
  })
  it("renders General results alongside existing sections and resets event-tab filters", async () => {
    const html = renderToStaticMarkup(await page({ event: event.slug }))
    expect(getJudgingResults).toHaveBeenCalledWith(id, {
      trackId: null,
      page: 1,
    })
    for (const text of [
      "Submitted projects",
      "Existing settings",
      "Existing judge roster",
      "Assignments",
      "General results",
      "Winner decisions are manual",
    ])
      expect(html).toContain(text)
    expect(html).toContain('href="/judging?event=other"')
    expect(html).not.toContain("follow-up work")
  })
  it("loads the exact event/track/page and preserves all sections during navigation", async () => {
    getJudgingResults.mockResolvedValue({
      ...results,
      track_id: trackId,
      track_name: "Sponsor A",
      has_more: true,
    })
    const html = renderToStaticMarkup(
      await page({
        event: event.slug,
        resultsTrack: trackId,
        resultsPage: "2",
        projectsPage: "3",
        assignmentPage: "4",
        coveragePage: "5",
        assignmentStatus: "submitted",
        assignmentProject: id,
      })
    )
    expect(getJudgingResults).toHaveBeenCalledWith(id, { trackId, page: 2 })
    expect(getSubmittedProjects).toHaveBeenCalledWith(id, 3)
    expect(getAssignmentOverview).toHaveBeenCalledWith(id, {
      coveragePage: 5,
      assignmentPage: 4,
      status: "submitted",
      projectId: id,
    })
    expect(html).toContain(`resultsTrack=${trackId}&amp;resultsPage=2`)
    expect(html).toContain(`name="resultsTrack" value="${trackId}"`)
    expect(html).toContain('name="resultsPage" value="2"')
    expect(html).toContain(`resultsTrack=${trackId}&amp;resultsPage=3#results`)
    expect(html).toContain("projectsPage=4#submitted-projects")
    expect(html).toContain("assignmentPage=5")
    expect(html).toContain("coveragePage=6")
    expect(html).toContain('name="assignmentProject"')
  })
  it.each(["bad", [trackId, trackId], inactiveId, otherId])(
    "does not query or silently replace unavailable context %s",
    async (context) => {
      const html = renderToStaticMarkup(
        await page({ event: event.slug, resultsTrack: context })
      )
      expect(getJudgingResults).not.toHaveBeenCalled()
      expect(html).toContain("Results context unavailable")
      expect(html).not.toContain("General results")
      expect(html).toContain("Assignments")
    }
  )
  it("normalizes UUID casing and defaults malformed page values", async () => {
    await page({
      event: event.slug,
      resultsTrack: trackId.toUpperCase(),
      resultsPage: ["2"],
    })
    expect(getJudgingResults).toHaveBeenCalledWith(id, { trackId, page: 1 })
  })
  it("keeps second-event results scoped and never substitutes data on query failure", async () => {
    await page({ event: "other" })
    expect(getJudgingResults).toHaveBeenCalledWith(otherId, {
      trackId: null,
      page: 1,
    })
    getJudgingResults.mockRejectedValueOnce(new Error("Results unavailable"))
    await expect(page({ event: event.slug })).rejects.toThrow(
      "Results unavailable"
    )
  })
  it("shows no-event/unconfigured states and propagates track lookup failures", async () => {
    responses.events = { data: [], error: null }
    expect(renderToStaticMarkup(await page())).toContain("No events configured")
    expect(getJudgingResults).not.toHaveBeenCalled()
    responses.events = { data: [event], error: null }
    responses.event_competition_settings = { data: null, error: null }
    responses.competition_tracks = { data: [], error: null }
    getJudgingResults.mockResolvedValueOnce({ ...results, target: null })
    expect(renderToStaticMarkup(await page())).toContain(
      "Save event settings before viewing results"
    )
    responses.competition_tracks = {
      data: null,
      error: { message: "Tracks unavailable" },
    }
    await expect(page()).rejects.toThrow("Tracks unavailable")
  })
})
