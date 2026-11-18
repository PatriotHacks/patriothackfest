import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, from, getApplicant, notFound } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  getApplicant: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("Not found")
  }),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/applicant", () => ({ getApplicant }))
vi.mock("next/navigation", () => ({ notFound }))
import {
  getCurrentProjectEvent,
  getProjectDetail,
  getProjectEvent,
  getProjectEvents,
} from "./project-data"

const id = "a0000000-0000-4000-8000-000000000001"
beforeEach(() => {
  vi.clearAllMocks()
  getApplicant.mockResolvedValue({ supabase: { rpc, from } })
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

describe("getCurrentProjectEvent", () => {
  const other = "a0000000-0000-4000-8000-000000000002"
  function eventsQuery(result: { data: unknown; error: unknown }) {
    const query = {
      select: vi.fn(() => query),
      in: vi.fn(() => query),
      order: vi.fn(() => query),
      then: (resolve: (value: unknown) => void) => resolve(result),
    }
    from.mockReturnValue(query)
    return query
  }

  it("selects the earliest listed event that has not ended", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-05-01T00:00:00Z") })
    rpc.mockResolvedValue({
      data: [{ event_id: id }, { event_id: other }],
      error: null,
    })
    const ended = {
      id,
      slug: "spring-2026",
      starts_at: "2026-03-01T14:00:00Z",
      ends_at: "2026-03-02T22:00:00Z",
    }
    const next = {
      id: other,
      slug: "fall-2026",
      starts_at: "2026-10-13T14:00:00Z",
      ends_at: null,
    }
    const query = eventsQuery({ data: [ended, next], error: null })
    expect(await getCurrentProjectEvent()).toBe(next)
    expect(from).toHaveBeenCalledWith("events")
    expect(query.in).toHaveBeenCalledWith("id", [id, other])
    vi.useRealTimers()
  })

  it("returns null without querying events when none are listed", async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    expect(await getCurrentProjectEvent()).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it("surfaces event query failures", async () => {
    rpc.mockResolvedValue({ data: [{ event_id: id }], error: null })
    eventsQuery({ data: null, error: { message: "Database unavailable" } })
    await expect(getCurrentProjectEvent()).rejects.toThrow(
      "Database unavailable"
    )
  })
})
