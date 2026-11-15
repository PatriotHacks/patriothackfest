import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath }))
import { saveEventJudge } from "./judges-actions"
const id = "a0000000-0000-4000-8000-000000000001"
const input = {
  eventId: id,
  email: " Person@Example.com ",
  kind: "general",
  active: true,
  capacity: 20,
  trackIds: [],
}
beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ supabase: { rpc } })
  rpc.mockResolvedValue({ error: null })
})
describe("judge admin action", () => {
  it("requires organizer access and scopes writes to the event", async () => {
    expect(await saveEventJudge(input)).toEqual({ error: null })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(rpc).toHaveBeenCalledWith("admin_save_event_judge", {
      p_event_id: id,
      p_judge_id: undefined,
      p_email: "person@example.com",
      p_kind: "general",
      p_active: true,
      p_capacity: 20,
      p_track_ids: [],
    })
    expect(revalidatePath).toHaveBeenCalledWith("/judging")
  })
  it("never writes when authorization or validation fails", async () => {
    expect((await saveEventJudge({ ...input, capacity: 0 })).error).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
    requireAdmin.mockRejectedValue(new Error("Forbidden"))
    await expect(saveEventJudge(input)).rejects.toThrow("Forbidden")
    expect(rpc).not.toHaveBeenCalled()
  })
  it("returns lifecycle/assignment errors without claiming success", async () => {
    rpc.mockResolvedValue({
      error: {
        message: "Cannot remove a sponsor track referenced by an assignment",
      },
    })
    expect((await saveEventJudge(input)).error).toContain(
      "referenced by an assignment"
    )
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
