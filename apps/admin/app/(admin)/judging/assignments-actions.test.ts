import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath }))
import {
  addAssignment,
  cancelAssignment,
  generateAssignments,
  getAssignmentCandidates,
  reassignAssignment,
} from "./assignments-actions"
const id = "a0000000-0000-4000-8000-000000000001"
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
  it("scopes manual operations and uses SQL NULL defaults for general", async () => {
    await addAssignment({
      eventId: id,
      projectId: id,
      judgeId: id,
      trackId: null,
    })
    expect(rpc).toHaveBeenLastCalledWith("admin_add_assignment", {
      p_event_id: id,
      p_project_id: id,
      p_judge_id: id,
      p_track_id: undefined,
    })
    await addAssignment({
      eventId: id,
      projectId: id,
      judgeId: id,
      trackId: id,
    })
    expect(rpc).toHaveBeenLastCalledWith("admin_add_assignment", {
      p_event_id: id,
      p_project_id: id,
      p_judge_id: id,
      p_track_id: id,
    })
    await cancelAssignment({ eventId: id, assignmentId: id })
    expect(rpc).toHaveBeenLastCalledWith("admin_cancel_assignment", {
      p_event_id: id,
      p_assignment_id: id,
    })
    await reassignAssignment({ eventId: id, assignmentId: id, judgeId: id })
    expect(rpc).toHaveBeenLastCalledWith("admin_reassign_assignment", {
      p_event_id: id,
      p_assignment_id: id,
      p_judge_id: id,
    })
  })
  it("does not mutate malformed input or bypass authorization", async () => {
    for (const action of [
      addAssignment,
      cancelAssignment,
      reassignAssignment,
      generateAssignments,
      getAssignmentCandidates,
    ]) {
      expect((await action({ eventId: "bad" })).error).toBeTruthy()
    }
    expect(rpc).not.toHaveBeenCalled()
    requireAdmin.mockRejectedValueOnce(new Error("Forbidden"))
    await expect(generateAssignments({ eventId: id })).rejects.toThrow(
      "Forbidden"
    )
  })
  it("reports database errors and does not revalidate on failure", async () => {
    rpc.mockResolvedValue({
      error: {
        message: "Only untouched assignments can be cancelled or reassigned",
      },
    })
    expect(
      (await cancelAssignment({ eventId: id, assignmentId: id })).error
    ).toContain("Only untouched")
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it("returns parsed eligible candidates without revalidating", async () => {
    rpc.mockResolvedValue({
      error: null,
      data: [
        {
          judge_id: id,
          email: "judge@example.test",
          workload: 2,
          capacity: 20,
        },
      ],
    })
    expect(
      (
        await getAssignmentCandidates({
          eventId: id,
          projectId: id,
          trackId: null,
        })
      ).candidates
    ).toHaveLength(1)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
