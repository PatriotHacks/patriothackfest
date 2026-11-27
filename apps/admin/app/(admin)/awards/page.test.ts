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
vi.mock("@/app/(admin)/awards/actions", () => ({
  assignAward: vi.fn(),
  deleteAward: vi.fn(),
  saveAward: vi.fn(),
  unassignAward: vi.fn(),
}))
import AwardsPage from "./page"

const id = "a0000000-0000-4000-8000-000000000001"
const trackId = "b0000000-0000-4000-8000-000000000001"
const event = {
  id,
  slug: "fall-2026",
  name: "Fall",
  starts_at: null,
  ends_at: null,
}
const award = {
  id: "f0000000-0000-4000-8000-000000000001",
  name: "Grand prize",
  rank: 1,
  track_id: null,
  projects: [
    {
      id: "c0000000-0000-4000-8000-000000000001",
      name: "Winner",
      status: "withdrawn",
    },
  ],
}
let responses: Record<
  string,
  { data: unknown; error: { message: string } | null }
>
const page = (query: Record<string, string | string[] | undefined> = {}) =>
  AwardsPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(query),
  })

beforeEach(() => {
  vi.clearAllMocks()
  responses = {
    events: { data: [event], error: null },
    event_competition_settings: {
      data: { gallery_published: false },
      error: null,
    },
    competition_tracks: {
      data: [
        { id: trackId, name: "Health", active: true },
        { id, name: "Retired", active: false },
      ],
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
    data: {
      awards: [award],
      projects: [
        {
          id: "c0000000-0000-4000-8000-000000000002",
          name: "Candidate",
          track_ids: [],
        },
      ],
    },
    error: null,
  })
})

describe("awards page", () => {
  it("redirects reviewers before any reads", async () => {
    getAdmin.mockResolvedValue({ level: "reviewer" })
    await expect(page()).rejects.toThrow("Redirect to forms")
    expect(redirect).toHaveBeenCalledWith("/forms")
    expect(from).not.toHaveBeenCalled()
  })
  it("renders awards, winners, and the add form", async () => {
    const html = renderToStaticMarkup(await page({ event: event.slug }))
    expect(rpc).toHaveBeenCalledWith("admin_awards", { p_event_id: id })
    for (const text of [
      'href="/awards?event=fall-2026"',
      'value="Grand prize"',
      "Winner",
      "(withdrawn, hidden from the gallery)",
      "Add winner",
      "Delete award",
      "Add award",
      "The gallery for this event is not published",
    ])
      expect(html).toContain(text)
  })
  it("asks for competition settings before awards", async () => {
    responses.event_competition_settings = { data: null, error: null }
    const html = renderToStaticMarkup(await page())
    expect(html).toContain("Save competition settings in Submission Forms")
    expect(html).not.toContain("Add award")
  })
  it("surfaces award listing errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Not authorized" } })
    await expect(page()).rejects.toThrow("Not authorized")
  })
})
