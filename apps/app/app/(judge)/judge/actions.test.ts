import { beforeEach, describe, expect, it, vi } from "vitest"
const {
  getApplicant,
  rpc,
  revalidatePath,
  getJudgeQueue,
  getJudgeEvent,
  acknowledgeJudgeBriefing,
} = vi.hoisted(() => ({
  getApplicant: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  getJudgeQueue: vi.fn(),
  getJudgeEvent: vi.fn(),
  acknowledgeJudgeBriefing: vi.fn(),
}))
vi.mock("@/lib/applicant", () => ({ getApplicant }))
vi.mock("next/cache", () => ({ revalidatePath }))
vi.mock("@/lib/judge-review-data", () => ({
  getJudgeQueue,
  acknowledgeJudgeBriefing,
}))
vi.mock("@/lib/judge-access", () => ({ getJudgeEvent }))
import {
  acknowledgeBriefing,
  checkJudgeReview,
  continueJudgeQueue,
  saveJudgeReview,
} from "./actions"
const id = "a0000000-0000-4000-8000-000000000001"
const other = "a0000000-0000-4000-8000-000000000002"
const scores = { [id]: 3.5, [other]: 4 }
const input = {
  eventSlug: "fall-2026",
  assignmentId: id,
  scores,
  notes: "notes",
  submit: true,
}
const assignment = {
  id,
  scores,
  track_id: null,
  track_name: null,
  notes: "notes",
  submitted_at: "2026-11-20T12:00:00Z",
}
const queue = (submitted: (string | null)[]) => ({
  total: submitted.length,
  completed: submitted.filter(Boolean).length,
  assignments: submitted.map((submitted_at, index) => ({
    id: `a0000000-0000-4000-8000-00000000000${index + 1}`,
    project_name: `Project ${index + 1}`,
    track_id: null,
    track_name: null,
    submitted_at,
    in_progress: false,
  })),
})
beforeEach(() => {
  vi.resetAllMocks()
  getApplicant.mockResolvedValue({ supabase: { rpc } })
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
    expect(revalidatePath).toHaveBeenCalledWith("/judge")
  })
  it.each([0.9, 5.1, 2.55, "3"])(
    "rejects invalid score %s without writing",
    async (score) => {
      expect(
        (await saveJudgeReview({ ...input, scores: { [id]: score } })).error
      ).toBeTruthy()
      expect(rpc).not.toHaveBeenCalled()
    }
  )
  it("rejects non-criterion keys and extra fields", async () => {
    expect(
      (await saveJudgeReview({ ...input, scores: { creativity: 3 } })).error
    ).toBeTruthy()
    expect((await saveJudgeReview({ ...input, total: 5 })).error).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
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
  it("continues to the next unsubmitted assignment after the current one", async () => {
    getJudgeQueue.mockResolvedValue(queue([null, null, "done", null]))
    expect(
      await continueJudgeQueue(
        "fall-2026",
        "a0000000-0000-4000-8000-000000000002"
      )
    ).toEqual({
      error: null,
      href: "/judge/fall-2026/a0000000-0000-4000-8000-000000000004",
    })
  })
  it("returns to the dashboard when every review is submitted", async () => {
    getJudgeQueue.mockResolvedValue(queue(["done", "done"]))
    expect((await continueJudgeQueue("fall-2026", id)).href).toBe("/judge")
  })
  it("reports a failed next-queue read", async () => {
    getJudgeQueue.mockRejectedValue(new Error("offline"))
    expect((await continueJudgeQueue("fall-2026")).error).toContain(
      "Could not load"
    )
  })
  it("records the briefing then opens the first unsubmitted assignment", async () => {
    getJudgeQueue.mockResolvedValue(queue(["done", null]))
    expect(await acknowledgeBriefing("fall-2026")).toEqual({
      error: null,
      href: "/judge/fall-2026/a0000000-0000-4000-8000-000000000002",
    })
    expect(acknowledgeJudgeBriefing).toHaveBeenCalledWith("fall-2026")
  })
  it("stays on the briefing when acknowledgement fails", async () => {
    acknowledgeJudgeBriefing.mockRejectedValue(new Error("denied"))
    expect((await acknowledgeBriefing("fall-2026")).href).toBeUndefined()
    expect(getJudgeQueue).not.toHaveBeenCalled()
  })
  it("fails closed for revoked extension checks", async () => {
    getJudgeEvent.mockResolvedValue(null)
    expect((await checkJudgeReview("fall-2026")).error).toContain(
      "Judge access unavailable"
    )
  })
  it("checks current access and deadline", async () => {
    getJudgeEvent.mockResolvedValue({
      judging_close_at: "2026-11-22T05:00:00Z",
    })
    const result = await checkJudgeReview("fall-2026")
    expect(result.error).toBeNull()
    expect(result.event?.judging_close_at).toBe("2026-11-22T05:00:00Z")
  })
})
