import { beforeEach, describe, expect, it, vi } from "vitest"
const { getApplicant, rpc } = vi.hoisted(() => ({
  getApplicant: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/applicant", () => ({ getApplicant }))
import { getJudgeEvent, getJudgeEvents } from "./judge-access"

const event = {
  event_id: "a0000000-0000-4000-8000-000000000001",
  slug: "fall-2026",
  name: "Fall",
  kind: "general",
  guest: false,
  capacity: 20,
  enabled: false,
  judging_started_at: null,
  judging_close_at: null,
  briefing_acknowledged_at: null,
  tracks: [],
}
beforeEach(() => {
  vi.clearAllMocks()
  getApplicant.mockResolvedValue({ supabase: { rpc } })
})
describe("judge data authorization", () => {
  it("lists only caller-scoped events without reading applications or names", async () => {
    rpc.mockResolvedValue({ data: [event], error: null })
    expect(await getJudgeEvents()).toEqual([event])
    expect(rpc).toHaveBeenCalledWith("judge_events")
  })
  it("checks/binds event access through the database on each request", async () => {
    rpc.mockResolvedValue({ data: event, error: null })
    expect(await getJudgeEvent("fall-2026")).toEqual(event)
    expect(rpc).toHaveBeenCalledWith("judge_event_access", {
      p_event_slug: "fall-2026",
    })
  })
  it("returns access unavailable when a judge was revoked", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await getJudgeEvent("fall-2026")).toBeNull()
  })
  it("does not hide database failures as access denial", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Database unavailable" },
    })
    await expect(getJudgeEvent("fall-2026")).rejects.toThrow(
      "Database unavailable"
    )
    await expect(getJudgeEvents()).rejects.toThrow("Database unavailable")
  })
  it("requires the existing OTP authentication helper", async () => {
    getApplicant.mockRejectedValue(new Error("Sign in with OTP"))
    await expect(getJudgeEvent("fall-2026")).rejects.toThrow("Sign in with OTP")
    expect(rpc).not.toHaveBeenCalled()
  })
})
