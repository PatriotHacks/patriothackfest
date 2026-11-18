import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getAdmin, from, getEventProjects, redirect } = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  from: vi.fn(),
  getEventProjects: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("Redirect to forms")
  }),
}))
vi.mock("@/lib/admin", () => ({ getAdmin }))
vi.mock("@/lib/organizer-project-data", () => ({ getEventProjects }))
vi.mock("next/navigation", () => ({ redirect }))
import ProjectSubmissionsPage from "./page"

const id = "a0000000-0000-4000-8000-000000000001"
const event = {
  id,
  slug: "fall-2026",
  name: "Fall",
  starts_at: null,
  ends_at: null,
}
let events: { data: unknown; error: { message: string } | null }
const page = (query: Record<string, string | string[] | undefined> = {}) =>
  ProjectSubmissionsPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(query),
  })

beforeEach(() => {
  vi.clearAllMocks()
  events = { data: [event], error: null }
  from.mockImplementation(() =>
    Object.assign(Promise.resolve(events), {
      select() {
        return this
      },
      order() {
        return this
      },
    })
  )
  getAdmin.mockResolvedValue({ level: "organizer", supabase: { from } })
  getEventProjects.mockResolvedValue({
    projects: [],
    has_more: false,
    required_count: 0,
    counts: { draft: 0, submitted: 0, withdrawn: 0 },
  })
})

describe("organizer project submissions page", () => {
  it("redirects reviewers before any project reads", async () => {
    getAdmin.mockResolvedValue({ level: "reviewer" })
    await expect(page()).rejects.toThrow("Redirect to forms")
    expect(redirect).toHaveBeenCalledWith("/forms")
    expect(from).not.toHaveBeenCalled()
    expect(getEventProjects).not.toHaveBeenCalled()
  })
  it("passes the selected event, status, and page to the list", async () => {
    const html = renderToStaticMarkup(
      await page({ event: event.slug, status: "draft", projectsPage: "2" })
    )
    expect(getEventProjects).toHaveBeenCalledWith(id, {
      status: "draft",
      page: 2,
    })
    expect(html).toContain("Project Submissions")
    expect(html).toContain('href="/project-submissions?event=fall-2026"')
  })
  it("lists every status for unknown status values", async () => {
    await page({ status: "archived" })
    expect(getEventProjects).toHaveBeenCalledWith(id, {
      status: null,
      page: 1,
    })
  })
  it("propagates event lookup failures and handles no events", async () => {
    events = { data: null, error: { message: "Events failed" } }
    await expect(page()).rejects.toThrow("Events failed")
    events = { data: [], error: null }
    expect(renderToStaticMarkup(await page())).toContain("No events configured")
    expect(getEventProjects).not.toHaveBeenCalled()
  })
})
