import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getAdmin, from, rpc, redirect } = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("Redirect to forms")
  }),
}))
vi.mock("@/lib/admin", () => ({ getAdmin }))
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/components/submission-forms/settings-form", () => ({
  SubmissionSettingsForm: () => "Existing submission settings",
}))
vi.mock("@/components/submission-forms/questions", () => ({
  ProjectQuestions: ({ questions }: { questions: unknown[] }) =>
    `Questions editor (${questions.length})`,
}))
vi.mock("@/components/submission-forms/judge-visibility", () => ({
  JudgeVisibilityToggle: ({ enabled }: { enabled: boolean }) =>
    `Judge visibility ${enabled}`,
}))
vi.mock("@/components/submission-forms/gallery-toggle", () => ({
  GalleryPublishToggle: ({ published }: { published: boolean }) =>
    `Gallery published ${published}`,
}))
vi.mock("@/components/submission-forms/team-settings", () => ({
  TeamSettings: ({
    maxTeamSize,
    judgesSeeTeam,
  }: {
    maxTeamSize: number | null
    judgesSeeTeam: boolean
  }) => `Team settings ${maxTeamSize} ${judgesSeeTeam}`,
}))
vi.mock("@/components/judging/track-form", () => ({
  CompetitionTrackForm: () => "Existing track settings",
}))
import SubmissionFormsPage from "./page"

const id = "a0000000-0000-4000-8000-000000000001"
const event = {
  id,
  slug: "fall-2026",
  name: "Fall",
  starts_at: null,
  ends_at: null,
}
let responses: Record<
  string,
  { data: unknown; error: { message: string } | null }
>
const page = (query: Record<string, string | string[] | undefined> = {}) =>
  SubmissionFormsPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(query),
  })

beforeEach(() => {
  vi.clearAllMocks()
  responses = {
    events: { data: [event], error: null },
    event_competition_settings: {
      data: {
        judging_started_at: null,
        judges_see_answers: true,
        judges_see_team: false,
        max_team_size: 4,
        gallery_published: true,
      },
      error: null,
    },
    competition_tracks: {
      data: [{ id, name: "Sponsor A", active: true }],
      error: null,
    },
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
  rpc.mockResolvedValue({
    data: [
      {
        id,
        event_id: id,
        position: 1,
        label: "Why?",
        help_text: null,
        required: false,
        type: "long_text",
        max_length: 5000,
        length_unit: "characters" as const,
        options: null,
        validation: null,
        archived_options: null,
        archived_at: null,
        created_at: "2026-11-15T05:00:00Z",
        updated_at: "2026-11-15T05:00:00Z",
        answered: false,
        gallery_public: false,
        gallery_summary: false,
      },
    ],
    error: null,
  })
})

describe("organizer submission forms page", () => {
  it("redirects reviewers before any competition reads", async () => {
    getAdmin.mockResolvedValue({ level: "reviewer" })
    await expect(page()).rejects.toThrow("Redirect to forms")
    expect(redirect).toHaveBeenCalledWith("/forms")
    expect(from).not.toHaveBeenCalled()
  })
  it("renders settings, questions, visibility, teams, and tracks without projects", async () => {
    const html = renderToStaticMarkup(await page({ event: event.slug }))
    expect(rpc).toHaveBeenCalledWith("admin_project_questions", {
      p_event_id: id,
    })
    for (const text of [
      "Submission Forms",
      "Existing submission settings",
      "Questions editor (1)",
      "Judge visibility true",
      "Team settings 4 false",
      "Gallery published true",
      "Existing track settings",
    ])
      expect(html).toContain(text)
    expect(html).toContain('href="/submission-forms?event=fall-2026"')
    expect(html).not.toContain("Assignments")
    expect(html).not.toContain("Submitted projects")
  })
  it("requires saved settings before tracks and visibility", async () => {
    responses.event_competition_settings = { data: null, error: null }
    const html = renderToStaticMarkup(await page())
    expect(html).toContain("Save event settings before adding tracks")
    expect(html).toContain(
      "Save event settings before choosing whether judges see answers"
    )
    expect(html).toContain("Save event settings before configuring teams")
    expect(html).toContain("Save event settings before publishing the gallery")
  })
  it("propagates question and event lookup failures", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "No questions" } })
    await expect(page()).rejects.toThrow("No questions")
    responses.events = { data: [], error: null }
    expect(renderToStaticMarkup(await page())).toContain("No events configured")
  })
})
