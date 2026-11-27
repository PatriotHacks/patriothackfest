import { beforeEach, describe, expect, it, vi } from "vitest"

const { rpc, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath }))

import { assignAward, deleteAward, saveAward, unassignAward } from "./actions"

const eventId = "e0000000-0000-4000-8000-000000000001"
const awardId = "f0000000-0000-4000-8000-000000000001"
const projectId = "a0000000-0000-4000-8000-000000000001"
const trackId = "b0000000-0000-4000-8000-000000000001"

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ supabase: { rpc } })
  rpc.mockResolvedValue({ error: null })
})

describe("award server actions", () => {
  it("requires organizer permission for every mutation", async () => {
    await saveAward({ eventId, name: "Best", rank: 1, trackId: null })
    await deleteAward(eventId, awardId)
    await assignAward({ eventId, awardId, projectId })
    await unassignAward({ eventId, awardId, projectId })
    expect(requireAdmin).toHaveBeenCalledTimes(4)
    expect(
      requireAdmin.mock.calls.every(([level]) => level === "organizer")
    ).toBe(true)
  })
  it("saves trimmed awards and clears the track for general awards", async () => {
    expect(
      await saveAward({
        eventId,
        awardId,
        name: " Best ",
        rank: 2,
        trackId: null,
      })
    ).toEqual({ error: null })
    expect(rpc).toHaveBeenCalledWith("admin_save_award", {
      p_event_id: eventId,
      p_award_id: awardId,
      p_name: "Best",
      p_rank: 2,
      p_track_id: undefined,
    })
    await saveAward({ eventId, name: "Track", rank: 1, trackId })
    expect(rpc).toHaveBeenLastCalledWith("admin_save_award", {
      p_event_id: eventId,
      p_award_id: undefined,
      p_name: "Track",
      p_rank: 1,
      p_track_id: trackId,
    })
    expect(revalidatePath).toHaveBeenCalledWith("/awards")
  })
  it("rejects invalid awards before the database", async () => {
    expect(
      await saveAward({ eventId, name: "", rank: 1, trackId: null })
    ).toEqual({ error: "Enter an award name" })
    expect(await deleteAward(eventId, "bad")).toEqual({
      error: "Invalid award",
    })
    expect(await assignAward({ eventId, awardId, projectId: "bad" })).toEqual({
      error: "Invalid award winner",
    })
    expect(rpc).not.toHaveBeenCalled()
  })
  it("assigns, unassigns, and deletes by event", async () => {
    await assignAward({ eventId, awardId, projectId })
    expect(rpc).toHaveBeenCalledWith("admin_assign_award", {
      p_event_id: eventId,
      p_award_id: awardId,
      p_project_id: projectId,
    })
    await unassignAward({ eventId, awardId, projectId })
    expect(rpc).toHaveBeenCalledWith("admin_unassign_award", {
      p_event_id: eventId,
      p_award_id: awardId,
      p_project_id: projectId,
    })
    await deleteAward(eventId, awardId)
    expect(rpc).toHaveBeenCalledWith("admin_delete_award", {
      p_event_id: eventId,
      p_award_id: awardId,
    })
  })
  it("preserves database errors without revalidating", async () => {
    rpc.mockResolvedValue({
      error: { message: "This project is not entered in the award track" },
    })
    expect(await assignAward({ eventId, awardId, projectId })).toEqual({
      error: "This project is not entered in the award track",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
