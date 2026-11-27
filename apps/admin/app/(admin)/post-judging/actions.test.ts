import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, remove, createSignedUrl, from, requireAdmin, revalidatePath } =
  vi.hoisted(() => ({
    rpc: vi.fn(),
    remove: vi.fn(),
    createSignedUrl: vi.fn(),
    from: vi.fn(),
    requireAdmin: vi.fn(),
    revalidatePath: vi.fn(),
  }))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath }))
import {
  judgeDocumentUrl,
  saveJudgeCertificate,
  saveJudgeInvitationLetter,
} from "./actions"

const eventId = "a0000000-0000-4000-8000-000000000001"
const judgeId = "b0000000-0000-4000-8000-000000000001"
const path = `${eventId}/certificates/${judgeId}/c0000000-0000-4000-8000-000000000001.pdf`
const previous = `${eventId}/certificates/${judgeId}/c0000000-0000-4000-8000-000000000002.pdf`
beforeEach(() => {
  vi.clearAllMocks()
  from.mockReturnValue({ remove, createSignedUrl })
  requireAdmin.mockResolvedValue({ supabase: { rpc, storage: { from } } })
  rpc.mockResolvedValue({ data: null, error: null })
  remove.mockResolvedValue({ data: [], error: null })
})

describe("certificate actions", () => {
  it("records the upload and deletes the file it replaced", async () => {
    rpc.mockResolvedValue({ data: previous, error: null })
    expect(await saveJudgeCertificate({ eventId, judgeId, path })).toEqual({
      error: null,
    })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(rpc).toHaveBeenCalledWith("admin_set_judge_certificate", {
      p_event_id: eventId,
      p_judge_id: judgeId,
      p_path: path,
    })
    expect(from).toHaveBeenCalledWith("judge-documents")
    expect(remove).toHaveBeenCalledWith([previous])
    expect(revalidatePath).toHaveBeenCalledWith("/post-judging")
  })
  it("clears the record when the path is null", async () => {
    rpc.mockResolvedValue({ data: previous, error: null })
    expect(
      await saveJudgeCertificate({ eventId, judgeId, path: null })
    ).toEqual({ error: null })
    expect(rpc).toHaveBeenCalledWith("admin_set_judge_certificate", {
      p_event_id: eventId,
      p_judge_id: judgeId,
      p_path: undefined,
    })
    expect(remove).toHaveBeenCalledWith([previous])
  })
  it("deletes nothing when there was no previous file", async () => {
    expect(await saveJudgeCertificate({ eventId, judgeId, path })).toEqual({
      error: null,
    })
    expect(remove).not.toHaveBeenCalled()
  })
  it("removes the new upload when recording fails", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Upload the file again" },
    })
    expect(await saveJudgeCertificate({ eventId, judgeId, path })).toEqual({
      error: "Upload the file again",
    })
    expect(remove).toHaveBeenCalledWith([path])
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it("reports a failed delete of the replaced file", async () => {
    rpc.mockResolvedValue({ data: previous, error: null })
    remove.mockResolvedValue({ data: null, error: { message: "Denied" } })
    expect(await saveJudgeCertificate({ eventId, judgeId, path })).toEqual({
      error: "Denied",
    })
    expect(revalidatePath).toHaveBeenCalledWith("/post-judging")
  })
  it("never writes for invalid input or without organizer access", async () => {
    expect(
      (await saveJudgeCertificate({ eventId, judgeId: "nope", path })).error
    ).toBeTruthy()
    expect(
      (await saveJudgeCertificate({ eventId, judgeId, path: "" })).error
    ).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
    requireAdmin.mockRejectedValue(new Error("Forbidden"))
    await expect(
      saveJudgeCertificate({ eventId, judgeId, path })
    ).rejects.toThrow("Forbidden")
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe("invitation letter actions", () => {
  const letter = `${eventId}/invitation-letters/${judgeId}/c0000000-0000-4000-8000-000000000003.pdf`
  it("records the judge's letter and deletes the file it replaced", async () => {
    rpc.mockResolvedValue({ data: previous, error: null })
    expect(
      await saveJudgeInvitationLetter({ eventId, judgeId, path: letter })
    ).toEqual({ error: null })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(rpc).toHaveBeenCalledWith("admin_set_judge_invitation_letter", {
      p_event_id: eventId,
      p_judge_id: judgeId,
      p_path: letter,
    })
    expect(remove).toHaveBeenCalledWith([previous])
    expect(revalidatePath).toHaveBeenCalledWith("/post-judging")
  })
  it("clears the record when the path is null", async () => {
    expect(
      await saveJudgeInvitationLetter({ eventId, judgeId, path: null })
    ).toEqual({ error: null })
    expect(rpc).toHaveBeenCalledWith("admin_set_judge_invitation_letter", {
      p_event_id: eventId,
      p_judge_id: judgeId,
      p_path: undefined,
    })
    expect(remove).not.toHaveBeenCalled()
  })
  it("removes the new upload when recording fails", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Upload the file again" },
    })
    expect(
      await saveJudgeInvitationLetter({ eventId, judgeId, path: letter })
    ).toEqual({ error: "Upload the file again" })
    expect(remove).toHaveBeenCalledWith([letter])
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it("never writes for invalid input", async () => {
    expect(
      (await saveJudgeInvitationLetter({ eventId, path: letter })).error
    ).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe("judge document links", () => {
  it("signs a 60-second link with the organizer's session", async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.test/file" },
      error: null,
    })
    expect(await judgeDocumentUrl(path)).toEqual({
      error: null,
      url: "https://signed.test/file",
    })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(createSignedUrl).toHaveBeenCalledWith(path, 60)
  })
  it("rejects empty paths without calling storage", async () => {
    expect(await judgeDocumentUrl("")).toEqual({ error: "File not found" })
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
