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
import {
  getSubmittedProject,
  getSubmittedProjects,
} from "./organizer-project-data"

const id = "a0000000-0000-4000-8000-000000000001"
const event = { id, slug: "fall-2026", name: "Fall" }
const detail = {
  project: {
    id,
    event_id: id,
    status: "submitted",
    name: "Demo",
    summary: "Summary",
    description: "Description",
    technologies: "",
    repository_url: null,
    demo_url: "https://example.com",
    video_url: null,
    submitted_at: "2026-11-15T05:00:00Z",
    updated_at: "2026-11-15T05:00:00Z",
  },
  owner: { id, full_name: "Owner" },
  collaborators: [],
  tracks: [],
}
beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ supabase: { rpc, from } })
  from.mockReturnValue({ select })
  select.mockReturnValue({ eq })
  eq.mockReturnValue({ maybeSingle })
  maybeSingle.mockResolvedValue({ data: event, error: null })
  rpc.mockResolvedValue({
    data: { projects: [], has_more: false },
    error: null,
  })
})

describe("organizer project data access", () => {
  it("requires organizer permission and passes selected event/page to the read RPC", async () => {
    expect(await getSubmittedProjects(id, 2)).toEqual({
      projects: [],
      has_more: false,
    })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(rpc).toHaveBeenCalledWith("admin_submitted_projects", {
      p_event_id: id,
      p_page: 2,
    })
    expect(from).not.toHaveBeenCalled()
  })
  it("does not query when authorization fails", async () => {
    requireAdmin.mockRejectedValue(new Error("Forbidden"))
    await expect(getSubmittedProjects(id, 1)).rejects.toThrow("Forbidden")
    await expect(getSubmittedProject("fall-2026", id)).rejects.toThrow(
      "Forbidden"
    )
    expect(from).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it("rejects invalid list parameters before querying", async () => {
    await expect(getSubmittedProjects("bad", 1)).rejects.toThrow()
    await expect(getSubmittedProjects(id, 0)).rejects.toThrow()
    await expect(getSubmittedProjects(id, 2147483648)).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
  })
  it("resolves exact detail event instead of falling back", async () => {
    rpc.mockResolvedValue({ data: detail, error: null })
    expect(await getSubmittedProject("fall-2026", id)).toEqual({
      event,
      detail,
    })
    expect(eq).toHaveBeenCalledWith("slug", "fall-2026")
    expect(rpc).toHaveBeenCalledWith("admin_submitted_project_detail", {
      p_event_id: id,
      p_project_id: id,
    })
  })
  it("normalizes valid UUID casing before querying and checking the result", async () => {
    rpc.mockResolvedValue({ data: detail, error: null })
    expect(await getSubmittedProject("fall-2026", id.toUpperCase())).toEqual({
      event,
      detail,
    })
    expect(rpc).toHaveBeenCalledWith("admin_submitted_project_detail", {
      p_event_id: id,
      p_project_id: id,
    })
  })
  it("returns not found for missing/malformed identity without probing other events", async () => {
    await expect(getSubmittedProject(undefined, id)).rejects.toThrow(
      "Not found"
    )
    await expect(getSubmittedProject(["fall-2026"], id)).rejects.toThrow(
      "Not found"
    )
    await expect(getSubmittedProject("fall-2026", "bad")).rejects.toThrow(
      "Not found"
    )
    expect(from).not.toHaveBeenCalled()
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(getSubmittedProject("missing-event", id)).rejects.toThrow(
      "Not found"
    )
    expect(rpc).not.toHaveBeenCalled()
  })
  it("returns not found for inaccessible/draft/withdrawn/mismatched details", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(getSubmittedProject("fall-2026", id)).rejects.toThrow(
      "Not found"
    )
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
    await expect(getSubmittedProject("fall-2026", id)).rejects.toThrow(
      "Not found"
    )
  })
  it("does not disguise database failures as an empty page or not found", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Database unavailable" },
    })
    await expect(getSubmittedProjects(id, 1)).rejects.toThrow(
      "Database unavailable"
    )
    await expect(getSubmittedProject("fall-2026", id)).rejects.toThrow(
      "Database unavailable"
    )
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "Event query failed" },
    })
    await expect(getSubmittedProject("fall-2026", id)).rejects.toThrow(
      "Event query failed"
    )
  })
})
