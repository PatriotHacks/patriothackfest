import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, getApplicant, notFound } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getApplicant: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("Not found")
  }),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/applicant", () => ({ getApplicant }))
vi.mock("next/navigation", () => ({ notFound }))
import {
  getProjectDetail,
  getProjectEvent,
  getProjectEvents,
} from "./project-data"

const id = "a0000000-0000-4000-8000-000000000001"
beforeEach(() => {
  vi.clearAllMocks()
  getApplicant.mockResolvedValue({ supabase: { rpc } })
})

describe("scoped project reads", () => {
  it("lists events through caller-scoped RPC, not visible admissions decisions", async () => {
    rpc.mockResolvedValue({
      data: [{ event_id: id, slug: "fall-2026" }],
      error: null,
    })
    expect(await getProjectEvents()).toEqual([
      { event_id: id, slug: "fall-2026" },
    ])
    expect(rpc).toHaveBeenCalledWith("participant_project_events")
  })
  it("does not resolve arbitrary/other-event slugs", async () => {
    rpc.mockResolvedValue({
      data: [{ event_id: id, slug: "fall-2026" }],
      error: null,
    })
    await expect(getProjectEvent("other-event")).rejects.toThrow("Not found")
  })
  it("uses not-found for inaccessible and malformed projects", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(getProjectDetail("bad-id", id)).rejects.toThrow("Not found")
    expect(rpc).not.toHaveBeenCalled()
    await expect(getProjectDetail(id, id)).rejects.toThrow("Not found")
    expect(rpc).toHaveBeenCalledWith("participant_project_detail", {
      p_project_id: id,
      p_event_id: id,
    })
  })
  it("does not disguise database failures as empty project lists", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Database unavailable" },
    })
    await expect(getProjectEvents()).rejects.toThrow("Database unavailable")
    await expect(getProjectDetail(id, id)).rejects.toThrow(
      "Database unavailable"
    )
  })
})
