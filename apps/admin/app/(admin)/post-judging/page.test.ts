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
vi.mock("@/app/(admin)/post-judging/actions", () => ({
  judgeDocumentUrl: vi.fn(),
  saveJudgeCertificate: vi.fn(),
  saveJudgeInvitationLetter: vi.fn(),
}))
import PostJudgingPage from "./page"

const id = "a0000000-0000-4000-8000-000000000001"
const event = {
  id,
  slug: "fall-2026",
  name: "Fall",
  starts_at: null,
  ends_at: null,
}
const judge = {
  id: "b0000000-0000-4000-8000-000000000001",
  email: "judge@example.com",
  guest: false,
  certificate_path: null,
  invitation_letter_path: null,
}
let responses: Record<
  string,
  { data: unknown; error: { message: string } | null }
>
const page = (query: Record<string, string | string[] | undefined> = {}) =>
  PostJudgingPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(query),
  })

beforeEach(() => {
  vi.clearAllMocks()
  responses = {
    events: { data: [event], error: null },
    event_competition_settings: {
      data: { event_id: id },
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
  rpc.mockResolvedValue({ data: [judge], error: null })
})

describe("post-judging page", () => {
  it("redirects reviewers before any reads", async () => {
    getAdmin.mockResolvedValue({ level: "reviewer" })
    await expect(page()).rejects.toThrow("Redirect to forms")
    expect(redirect).toHaveBeenCalledWith("/forms")
    expect(from).not.toHaveBeenCalled()
  })
  it("renders per-judge document controls for the active roster", async () => {
    const html = renderToStaticMarkup(await page({ event: event.slug }))
    expect(rpc).toHaveBeenCalledWith("admin_post_judging_roster", {
      p_event_id: id,
    })
    expect(html).toContain("Post-judging")
    expect(html).toContain('href="/post-judging?event=fall-2026"')
    expect(html).toContain("judge@example.com")
    expect(html).toContain("Upload Certificate for judge@example.com")
    expect(html).toContain("Upload Invitation letter for judge@example.com")
  })
  it("asks for competition settings before uploads", async () => {
    responses.event_competition_settings = { data: null, error: null }
    const html = renderToStaticMarkup(await page())
    expect(html).toContain("Save competition settings in Judging Management")
    expect(html).not.toContain("Judge documents")
  })
  it("surfaces roster errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Not authorized" } })
    await expect(page()).rejects.toThrow("Not authorized")
  })
})
