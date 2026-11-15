import { beforeEach, describe, expect, it, vi } from "vitest"
const { getApplicant, rpc } = vi.hoisted(() => ({
  getApplicant: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/applicant", () => ({ getApplicant }))
import { getJudgeAssignment, getJudgeQueue } from "./judge-review-data"
beforeEach(() => {
  vi.clearAllMocks()
  getApplicant.mockResolvedValue({ supabase: { rpc } })
})
describe("private judge reads", () => {
  it("uses caller-scoped RPCs and distinguishes denial", async () => {
    rpc.mockResolvedValue({
      data: { total: 0, completed: 0, assignments: [] },
      error: null,
    })
    expect(await getJudgeQueue("fall-2026")).toEqual({
      total: 0,
      completed: 0,
      assignments: [],
    })
    expect(rpc).toHaveBeenCalledWith("judge_queue", {
      p_event_slug: "fall-2026",
    })
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await getJudgeAssignment("fall-2026", "id")).toBeNull()
  })
  it("does not disguise deployment or parsing errors as empty queues", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Missing RPC" } })
    await expect(getJudgeQueue("fall-2026")).rejects.toThrow("Missing RPC")
    rpc.mockResolvedValue({ data: {}, error: null })
    await expect(getJudgeQueue("fall-2026")).rejects.toThrow()
  })
})
