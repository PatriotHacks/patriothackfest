import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, remove, from, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  remove: vi.fn(),
  from: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath }))
import {
  deleteEventJudge,
  previewJudgeTransfer,
  saveEventJudge,
  setEventJudgeGuest,
} from "./judges-actions"
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
  from.mockReturnValue({ remove })
  remove.mockResolvedValue({ data: [], error: null })
  requireAdmin.mockResolvedValue({ supabase: { rpc, storage: { from } } })
  rpc.mockResolvedValue({ data: { id, transfer: null }, error: null })
})
describe("judge admin action", () => {
  it("requires organizer access and scopes writes to the event", async () => {
    expect(await saveEventJudge(input)).toEqual({ error: null, transfer: null })
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
  it("returns the transfer made when a judge is deactivated", async () => {
    const transfer = { moved: 3, dropped_drafts: 1, missing: 1 }
    rpc.mockResolvedValue({ data: { id, transfer }, error: null })
    expect(await saveEventJudge({ ...input, active: false })).toEqual({
      error: null,
      transfer,
    })
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
  it("surfaces the judge/participant conflict inline", async () => {
    const message =
      "This email has a participant application for this event and cannot be a judge"
    rpc.mockResolvedValue({ error: { message } })
    expect(await saveEventJudge(input)).toEqual({ error: message })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
describe("delete judge action", () => {
  const judgeId = "a0000000-0000-4000-8000-000000000002"
  it("requires organizer access and deletes the event judge", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await deleteEventJudge({ eventId: id, judgeId })).toEqual({
      error: null,
    })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(rpc).toHaveBeenCalledWith("admin_delete_event_judge", {
      p_event_id: id,
      p_judge_id: judgeId,
    })
    expect(revalidatePath).toHaveBeenCalledWith("/judging")
    expect(remove).not.toHaveBeenCalled()
  })
  it("deletes the removed judge's certificate file", async () => {
    const certificate = `${id}/certificates/${judgeId}/c0000000-0000-4000-8000-000000000001.pdf`
    rpc.mockResolvedValue({ data: certificate, error: null })
    expect(await deleteEventJudge({ eventId: id, judgeId })).toEqual({
      error: null,
    })
    expect(from).toHaveBeenCalledWith("judge-documents")
    expect(remove).toHaveBeenCalledWith([certificate])
    expect(revalidatePath).toHaveBeenCalledWith("/post-judging")
    remove.mockResolvedValue({ data: null, error: { message: "Denied" } })
    expect(await deleteEventJudge({ eventId: id, judgeId })).toEqual({
      error: "Denied",
    })
  })
  it("never writes for invalid input", async () => {
    expect(
      (await deleteEventJudge({ eventId: id, judgeId: "nope" })).error
    ).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })
  it("returns the judging-started refusal", async () => {
    const message = "Judging has started; deactivate this judge instead"
    rpc.mockResolvedValue({ error: { message } })
    expect(await deleteEventJudge({ eventId: id, judgeId })).toEqual({
      error: message,
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
describe("guest judge actions", () => {
  const judgeId = "a0000000-0000-4000-8000-000000000002"
  it("sets guest status and returns the transfer", async () => {
    const transfer = { moved: 2, dropped_drafts: 0, missing: 0 }
    rpc.mockResolvedValue({ data: transfer, error: null })
    expect(
      await setEventJudgeGuest({ eventId: id, judgeId, guest: true })
    ).toEqual({ error: null, transfer })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(rpc).toHaveBeenCalledWith("admin_set_event_judge_guest", {
      p_event_id: id,
      p_judge_id: judgeId,
      p_guest: true,
    })
    expect(revalidatePath).toHaveBeenCalledWith("/judging")
  })
  it("never writes for invalid input and surfaces errors", async () => {
    expect(
      (await setEventJudgeGuest({ eventId: id, judgeId, guest: "yes" })).error
    ).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValue({ data: null, error: { message: "Not authorized" } })
    expect(
      await setEventJudgeGuest({ eventId: id, judgeId, guest: false })
    ).toEqual({ error: "Not authorized" })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it("previews the transfer without writing", async () => {
    const preview = { unsubmitted: 4, drafts: 1 }
    rpc.mockResolvedValue({ data: preview, error: null })
    expect(await previewJudgeTransfer({ eventId: id, judgeId })).toEqual({
      error: null,
      preview,
    })
    expect(rpc).toHaveBeenCalledWith("admin_judge_transfer_preview", {
      p_event_id: id,
      p_judge_id: judgeId,
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
