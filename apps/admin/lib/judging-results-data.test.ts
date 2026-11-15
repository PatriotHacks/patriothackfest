import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, requireAdmin } = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireAdmin: vi.fn(),
}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("server-only", () => ({}))
import { getJudgingResults } from "./judging-results-data"

const id = "a0000000-0000-4000-8000-000000000001"
const data = {
  track_id: null,
  track_name: null,
  target: 3,
  projects: [],
  has_more: false,
}
beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ supabase: { rpc } })
  rpc.mockResolvedValue({ data, error: null })
})
describe("organizer results reads", () => {
  it("requires organizer and sends exact event/context/page", async () => {
    expect(await getJudgingResults(id, {})).toEqual(data)
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(rpc).toHaveBeenCalledWith("admin_judging_results", {
      p_event_id: id,
      p_track_id: undefined,
      p_page: 1,
    })
    rpc.mockResolvedValueOnce({
      data: { ...data, track_id: id, track_name: "Sponsor" },
      error: null,
    })
    await getJudgingResults(id, { trackId: id, page: 2 })
    expect(rpc).toHaveBeenLastCalledWith("admin_judging_results", {
      p_event_id: id,
      p_track_id: id,
      p_page: 2,
    })
  })
  it("never queries invalid identities or inputs", async () => {
    await expect(getJudgingResults("bad", {})).rejects.toThrow()
    await expect(getJudgingResults(id, { trackId: "bad" })).rejects.toThrow()
    await expect(getJudgingResults(id, { page: 0 })).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
  })
  it("propagates auth/DB/shape/context failures, never fake empty results", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("Forbidden"))
    await expect(getJudgingResults(id, {})).rejects.toThrow("Forbidden")
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } })
    await expect(getJudgingResults(id, {})).rejects.toThrow("Unavailable")
    rpc.mockResolvedValueOnce({ data: {}, error: null })
    await expect(getJudgingResults(id, {})).rejects.toThrow()
    await expect(getJudgingResults(id, { trackId: id })).rejects.toThrow(
      "context does not match"
    )
  })
})
