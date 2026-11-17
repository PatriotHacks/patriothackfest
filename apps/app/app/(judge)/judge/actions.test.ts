import { beforeEach, describe, expect, it, vi } from "vitest"
const {
  getApplicant,
  rpc,
  revalidatePath,
  getJudgeQueue,
  getJudgeEvent,
  getJudgeAssignment,
  createSignedUrl,
} = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  getApplicant: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  getJudgeQueue: vi.fn(),
  getJudgeEvent: vi.fn(),
  getJudgeAssignment: vi.fn(),
}))
vi.mock("@/lib/applicant", () => ({ getApplicant }))
vi.mock("next/cache", () => ({ revalidatePath }))
vi.mock("@/lib/judge-review-data", () => ({
  getJudgeQueue,
  getJudgeAssignment,
}))
vi.mock("@/lib/judge-access", () => ({ getJudgeEvent }))
import {
  checkJudgeReview,
  continueJudgeQueue,
  judgeProjectFileUrl,
  saveJudgeReview,
} from "./actions"
const id = "a0000000-0000-4000-8000-000000000001"
const scores = {
  creativity_score: 3,
  technical_score: 3,
  impact_score: 3,
  presentation_score: 3,
}
const input = {
  eventSlug: "fall-2026",
  assignmentId: id,
  scores,
  notes: "notes",
  submit: true,
}
const assignment = {
  id,
  ...scores,
  track_id: null,
  track_name: null,
  notes: "notes",
  total_score: 12,
  submitted_at: "2026-11-20T12:00:00Z",
}
beforeEach(() => {
  vi.resetAllMocks()
  getApplicant.mockResolvedValue({
    supabase: { rpc, storage: { from: () => ({ createSignedUrl }) } },
  })
})
describe("judge review actions", () => {
  it("sends only score inputs through the caller client and returns authoritative state", async () => {
    rpc.mockResolvedValue({ data: assignment, error: null })
    expect(await saveJudgeReview(input)).toEqual({ error: null, assignment })
    expect(rpc).toHaveBeenCalledWith("judge_save_review", {
      p_event_slug: "fall-2026",
      p_assignment_id: id,
      p_scores: scores,
      p_notes: "notes",
      p_submit: true,
    })
    expect(revalidatePath).toHaveBeenCalledWith("/judge/fall-2026")
  })
  it("returns validation failures without writing or navigating", async () => {
    expect(
      (
        await saveJudgeReview({
          ...input,
          scores: { ...scores, impact_score: null },
        })
      ).error
    ).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it("acknowledges submitted persistence even if cache revalidation fails", async () => {
    rpc.mockResolvedValue({ data: assignment, error: null })
    revalidatePath.mockImplementation(() => {
      throw new Error("cache unavailable")
    })
    expect((await saveJudgeReview(input)).assignment?.submitted_at).toBe(
      assignment.submitted_at
    )
  })
  it("surfaces thrown transport failures for the controlled form to catch", async () => {
    rpc.mockRejectedValue(new Error("offline"))
    await expect(saveJudgeReview(input)).rejects.toThrow("offline")
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it("fails closed for revoked extension checks", async () => {
    getJudgeEvent.mockResolvedValue(null)
    expect(
      (await checkJudgeReview({ eventSlug: "fall-2026", assignmentId: id }))
        .error
    ).toContain("Judge access unavailable")
    expect(getJudgeAssignment).not.toHaveBeenCalled()
  })
  it("leaves deadline/revocation failures on the current assignment", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Judging has ended" },
    })
    expect(await saveJudgeReview(input)).toEqual({ error: "Judging has ended" })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it("authenticates even direct action calls", async () => {
    getApplicant.mockRejectedValue(new Error("Sign in"))
    await expect(saveJudgeReview(input)).rejects.toThrow("Sign in")
    expect(rpc).not.toHaveBeenCalled()
  })
  it("does not turn a failed next-queue read into a failed submission", async () => {
    getJudgeQueue.mockRejectedValue(new Error("offline"))
    expect((await continueJudgeQueue("fall-2026")).error).toContain(
      "review is submitted"
    )
  })
  it("checks current access/deadline without receiving unsaved field values", async () => {
    getJudgeEvent.mockResolvedValue({
      judging_close_at: "2026-11-22T05:00:00Z",
    })
    getJudgeAssignment.mockResolvedValue({ assignment })
    const result = await checkJudgeReview({
      eventSlug: "fall-2026",
      assignmentId: id,
    })
    expect(result.error).toBeNull()
    expect(result.event?.judging_close_at).toBe("2026-11-22T05:00:00Z")
    expect(result.assignment).toEqual(assignment)
  })
})

describe("judge file links", () => {
  const fileQuestion = "b0000000-0000-4000-8000-000000000001"
  const textQuestion = "b0000000-0000-4000-8000-000000000002"
  const path = `${id}/${fileQuestion}/${id}.pdf`
  const detail = {
    answers: [
      {
        question_id: fileQuestion,
        type: "file",
        answer: { path, name: "deck.pdf", size: 1, type: "application/pdf" },
      },
      { question_id: textQuestion, type: "long_text", answer: path },
    ],
  }
  it("signs only file answers from the judge's own visible assignment", async () => {
    getJudgeAssignment.mockResolvedValue(detail)
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.test/deck" },
      error: null,
    })
    expect(await judgeProjectFileUrl("fall-2026", id, fileQuestion)).toEqual({
      error: null,
      url: "https://signed.test/deck",
    })
    expect(getJudgeAssignment).toHaveBeenCalledWith("fall-2026", id)
    expect(createSignedUrl).toHaveBeenCalledWith(path, 60)
  })
  it("refuses hidden answers, unavailable assignments, and non-file questions", async () => {
    getJudgeAssignment.mockResolvedValue({ answers: [] })
    expect(
      (await judgeProjectFileUrl("fall-2026", id, fileQuestion)).error
    ).toBe("File not found")
    getJudgeAssignment.mockResolvedValue(null)
    expect(
      (await judgeProjectFileUrl("fall-2026", id, fileQuestion)).error
    ).toBe("File not found")
    getJudgeAssignment.mockResolvedValue(detail)
    expect(
      (await judgeProjectFileUrl("fall-2026", id, textQuestion)).error
    ).toBe("File not found")
    expect(
      (await judgeProjectFileUrl("bad slug", id, fileQuestion)).error
    ).toBe("File not found")
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
