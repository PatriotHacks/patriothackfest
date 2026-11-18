import { beforeEach, describe, expect, it, vi } from "vitest"
const { requireAdmin, rpc, from, select, eq, maybeSingle, notFound } =
  vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    rpc: vi.fn(),
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    notFound: vi.fn(() => {
      throw new Error("Not found")
    }),
  }))
vi.mock("server-only", () => ({}))
vi.mock("./admin", () => ({ requireAdmin }))
vi.mock("next/navigation", () => ({ notFound }))
import { getEventProjects, getProject } from "./organizer-project-data"

const id = "a0000000-0000-4000-8000-000000000001"
const event = { id, slug: "fall-2026", name: "Fall" }
const detail = {
  project: {
    id,
    event_id: id,
    status: "draft",
    name: "Demo",
    submitted_at: null,
    updated_at: "2026-11-15T05:00:00Z",
  },
  owner: { id, full_name: "Owner" },
  collaborators: [],
  tracks: [],
  answers: [],
}
const list = {
  projects: [],
  has_more: false,
  required_count: 2,
  counts: { draft: 0, submitted: 0, withdrawn: 0 },
}
beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ supabase: { rpc, from } })
  from.mockReturnValue({ select })
  select.mockReturnValue({ eq })
  eq.mockReturnValue({ maybeSingle })
  maybeSingle.mockResolvedValue({ data: event, error: null })
  rpc.mockResolvedValue({ data: list, error: null })
})

describe("organizer project data access", () => {
  it("requires organizer permission and passes selected event/status/page to the read RPC", async () => {
    expect(await getEventProjects(id, { status: "draft", page: 2 })).toEqual(
      list
    )
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(rpc).toHaveBeenCalledWith("admin_event_projects", {
      p_event_id: id,
      p_status: "draft",
      p_page: 2,
    })
    expect(from).not.toHaveBeenCalled()
  })
  it("omits the status to list every project", async () => {
    await getEventProjects(id, { status: null, page: 1 })
    expect(rpc).toHaveBeenCalledWith("admin_event_projects", {
      p_event_id: id,
      p_status: undefined,
      p_page: 1,
    })
  })
  it("does not query when authorization fails", async () => {
    requireAdmin.mockRejectedValue(new Error("Forbidden"))
    await expect(
      getEventProjects(id, { status: null, page: 1 })
    ).rejects.toThrow("Forbidden")
    await expect(getProject("fall-2026", id)).rejects.toThrow("Forbidden")
    expect(from).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it("rejects invalid list parameters before querying", async () => {
    await expect(
      getEventProjects("bad", { status: null, page: 1 })
    ).rejects.toThrow()
    await expect(
      getEventProjects(id, { status: null, page: 0 })
    ).rejects.toThrow()
    await expect(
      getEventProjects(id, { status: null, page: 2147483648 })
    ).rejects.toThrow()
    await expect(
      getEventProjects(id, {
        status: "archived" as never,
        page: 1,
      })
    ).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
  })
  it("resolves exact detail event instead of falling back and reads drafts", async () => {
    rpc.mockResolvedValue({ data: detail, error: null })
    expect(await getProject("fall-2026", id)).toEqual({
      event,
      detail,
    })
    expect(eq).toHaveBeenCalledWith("slug", "fall-2026")
    expect(rpc).toHaveBeenCalledWith("admin_project_detail", {
      p_event_id: id,
      p_project_id: id,
    })
  })
  it("normalizes valid UUID casing before querying and checking the result", async () => {
    rpc.mockResolvedValue({ data: detail, error: null })
    expect(await getProject("fall-2026", id.toUpperCase())).toEqual({
      event,
      detail,
    })
    expect(rpc).toHaveBeenCalledWith("admin_project_detail", {
      p_event_id: id,
      p_project_id: id,
    })
  })
  it("returns not found for missing/malformed identity without probing other events", async () => {
    await expect(getProject(undefined, id)).rejects.toThrow("Not found")
    await expect(getProject(["fall-2026"], id)).rejects.toThrow("Not found")
    await expect(getProject("fall-2026", "bad")).rejects.toThrow("Not found")
    expect(from).not.toHaveBeenCalled()
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(getProject("missing-event", id)).rejects.toThrow("Not found")
    expect(rpc).not.toHaveBeenCalled()
  })
  it("returns not found for missing or mismatched details", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(getProject("fall-2026", id)).rejects.toThrow("Not found")
    rpc.mockResolvedValue({
      data: {
        ...detail,
        project: {
          ...detail.project,
          event_id: "a0000000-0000-4000-8000-000000000002",
        },
      },
      error: null,
    })
    await expect(getProject("fall-2026", id)).rejects.toThrow("Not found")
  })
  it("does not disguise database failures as an empty page or not found", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Database unavailable" },
    })
    await expect(
      getEventProjects(id, { status: null, page: 1 })
    ).rejects.toThrow("Database unavailable")
    await expect(getProject("fall-2026", id)).rejects.toThrow(
      "Database unavailable"
    )
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "Event query failed" },
    })
    await expect(getProject("fall-2026", id)).rejects.toThrow(
      "Event query failed"
    )
  })
})
