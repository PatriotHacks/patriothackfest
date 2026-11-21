import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath }))
import {
  deleteJudgingCriterion,
  reorderJudgingCriteria,
  saveJudgingCriterion,
} from "./criteria-actions"
const id = "a0000000-0000-4000-8000-000000000001"
const criterionId = "c0000000-0000-4000-8000-000000000001"
beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ supabase: { rpc } })
  rpc.mockResolvedValue({ error: null })
})
describe("rubric admin actions", () => {
  it("saves trimmed criteria as an organizer", async () => {
    expect(
      await saveJudgingCriterion({
        eventId: id,
        name: "  Criterion A ",
        description: " Details ",
      })
    ).toEqual({ error: null })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(rpc).toHaveBeenCalledWith("admin_save_judging_criterion", {
      p_event_id: id,
      p_criterion_id: undefined,
      p_name: "Criterion A",
      p_description: "Details",
    })
    expect(revalidatePath).toHaveBeenCalledWith("/judging")
  })
  it.each([
    { name: " ", description: "" },
    { name: "x".repeat(121), description: "" },
    { name: "Criterion A", description: "x".repeat(2001) },
  ])("rejects invalid input without writing", async (value) => {
    expect(
      (await saveJudgingCriterion({ eventId: id, ...value })).error
    ).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })
  it("returns lock errors from the database", async () => {
    rpc.mockResolvedValue({
      error: { message: "Criteria are locked because judging has started" },
    })
    expect(await deleteJudgingCriterion({ eventId: id, criterionId })).toEqual({
      error: "Criteria are locked because judging has started",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it("reorders by full id list", async () => {
    await reorderJudgingCriteria({ eventId: id, criterionIds: [criterionId] })
    expect(rpc).toHaveBeenCalledWith("admin_reorder_judging_criteria", {
      p_event_id: id,
      p_criterion_ids: [criterionId],
    })
    expect(
      (await reorderJudgingCriteria({ eventId: id, criterionIds: ["x"] })).error
    ).toBeTruthy()
  })
})
