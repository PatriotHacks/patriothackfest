import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath }))
import {
  assignRemainingToJudge,
  generateAssignments,
  previewAssignRemainingToJudge,
  previewRebalanceAssignments,
  rebalanceAssignments,
} from "./assignments-actions"
const id = "a0000000-0000-4000-8000-000000000001"
const judgeId = "a0000000-0000-4000-8000-000000000002"
beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ supabase: { rpc } })
  rpc.mockResolvedValue({ error: null, data: { created: 2, missing: 1 } })
})
describe("assignment server actions", () => {
  it("returns generation summary and refreshes only successful mutations", async () => {
    expect(await generateAssignments({ eventId: id })).toEqual({
      error: null,
      summary: { created: 2, missing: 1 },
    })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(rpc).toHaveBeenCalledWith("admin_generate_assignments", {
      p_event_id: id,
    })
    expect(revalidatePath).toHaveBeenCalledWith("/judging")
  })
  it("does not mutate malformed input or bypass authorization", async () => {
    for (const action of [
      generateAssignments,
      previewRebalanceAssignments,
      rebalanceAssignments,
      previewAssignRemainingToJudge,
      assignRemainingToJudge,
    ]) {
      expect((await action({ eventId: "bad" })).error).toBeTruthy()
    }
    expect(rpc).not.toHaveBeenCalled()
    requireAdmin.mockRejectedValueOnce(new Error("Forbidden"))
    await expect(generateAssignments({ eventId: id })).rejects.toThrow(
      "Forbidden"
    )
  })
  it("previews a rebalance without revalidating and applies it with a refresh", async () => {
    const plan = {
      moved: 1,
      spread: 0,
      transfers: [
        {
          from_judge_id: id,
          from_email: "a@example.test",
          to_judge_id: id,
          to_email: "b@example.test",
          count: 1,
        },
      ],
    }
    rpc.mockResolvedValue({ error: null, data: plan })
    expect(await previewRebalanceAssignments({ eventId: id })).toEqual({
      error: null,
      plan,
    })
    expect(rpc).toHaveBeenLastCalledWith(
      "admin_rebalance_assignments_preview",
      { p_event_id: id }
    )
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(await rebalanceAssignments({ eventId: id })).toEqual({
      error: null,
      plan,
    })
    expect(rpc).toHaveBeenLastCalledWith("admin_rebalance_assignments", {
      p_event_id: id,
    })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(revalidatePath).toHaveBeenCalledWith("/judging")
  })
  it("does not revalidate a failed rebalance", async () => {
    rpc.mockResolvedValue({
      error: { message: "Start judging before managing assignments" },
    })
    expect((await rebalanceAssignments({ eventId: id })).error).toContain(
      "Start judging"
    )
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it("previews assigning remaining work without revalidating and applies it with a refresh", async () => {
    const plan = {
      moved: 1,
      skipped: {
        conflict: 0,
        ineligible_track: 1,
        capacity: 2,
        previously_held: 0,
      },
      sources: [{ judge_id: id, email: "a@example.test", count: 1 }],
    }
    const args = { p_event_id: id, p_judge_id: judgeId }
    rpc.mockResolvedValue({ error: null, data: plan })
    expect(
      await previewAssignRemainingToJudge({ eventId: id, judgeId })
    ).toEqual({ error: null, plan })
    expect(rpc).toHaveBeenLastCalledWith(
      "admin_assign_remaining_to_judge_preview",
      args
    )
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(await assignRemainingToJudge({ eventId: id, judgeId })).toEqual({
      error: null,
      plan,
    })
    expect(rpc).toHaveBeenLastCalledWith(
      "admin_assign_remaining_to_judge",
      args
    )
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(revalidatePath).toHaveBeenCalledWith("/judging")
  })
  it("rejects a missing judge and does not revalidate a failed apply", async () => {
    expect((await assignRemainingToJudge({ eventId: id })).error).toBe(
      "Invalid judge"
    )
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValue({
      error: {
        message: "Only active, non-guest judges can receive assignments",
      },
    })
    expect(
      (await assignRemainingToJudge({ eventId: id, judgeId })).error
    ).toContain("non-guest")
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
