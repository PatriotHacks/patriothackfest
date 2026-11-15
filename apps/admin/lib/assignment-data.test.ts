import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, requireAdmin } = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireAdmin: vi.fn(),
}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("server-only", () => ({}))
import { getAssignmentOverview } from "./assignment-data"
const id = "a0000000-0000-4000-8000-000000000001"
const data = {
  missing: 0,
  coverage: [],
  assignments: [],
  judges: [],
  coverage_has_more: false,
  assignments_has_more: false,
}
beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ supabase: { rpc } })
  rpc.mockResolvedValue({ data, error: null })
})
describe("assignment reads", () => {
  it("requires organizer and passes exact event/pages/filters", async () => {
    expect(
      await getAssignmentOverview(id, { projectId: id, status: "submitted" })
    ).toEqual(data)
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(rpc).toHaveBeenCalledWith("admin_assignment_overview", {
      p_event_id: id,
      p_coverage_page: 1,
      p_assignment_page: 1,
      p_project_id: id,
      p_status: "submitted",
    })
  })
  it("never queries malformed IDs and propagates auth/query/shape failures", async () => {
    await expect(getAssignmentOverview("bad", {})).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValueOnce({ error: { message: "Unavailable" } })
    await expect(getAssignmentOverview(id, {})).rejects.toThrow("Unavailable")
    rpc.mockResolvedValueOnce({ error: null, data: {} })
    await expect(getAssignmentOverview(id, {})).rejects.toThrow()
    requireAdmin.mockRejectedValueOnce(new Error("Forbidden"))
    await expect(getAssignmentOverview(id, {})).rejects.toThrow("Forbidden")
  })
})
