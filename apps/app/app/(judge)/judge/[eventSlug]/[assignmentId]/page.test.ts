import { beforeEach, describe, expect, it, vi } from "vitest"
const { getJudgeEvent, getJudgeAssignment, notFound } = vi.hoisted(() => ({
  getJudgeEvent: vi.fn(),
  getJudgeAssignment: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("Not found")
  }),
}))
vi.mock("@/lib/judge-access", () => ({ getJudgeEvent }))
vi.mock("@/lib/judge-review-data", () => ({ getJudgeAssignment }))
vi.mock("next/navigation", () => ({ notFound }))
vi.mock("@/app/(judge)/judge/actions", () => ({
  judgeProjectFileUrl: vi.fn(),
}))
vi.mock("@/components/judge/scorecard", () => ({
  JudgeScorecardForm: () => null,
}))
import JudgeAssignmentPage from "./page"
const id = "a0000000-0000-4000-8000-000000000001"
const props = {
  params: Promise.resolve({ eventSlug: "fall-2026", assignmentId: id }),
  searchParams: Promise.resolve({}),
}
beforeEach(() => vi.resetAllMocks())
describe("judge assignment route", () => {
  it("checks verified event access before requesting assignment content", async () => {
    getJudgeEvent.mockResolvedValue(null)
    await JudgeAssignmentPage(props)
    expect(getJudgeAssignment).not.toHaveBeenCalled()
  })
  it("uses both exact event and assignment identities", async () => {
    getJudgeEvent.mockResolvedValue({ name: "Fall" })
    getJudgeAssignment.mockResolvedValue(null)
    await JudgeAssignmentPage(props)
    expect(getJudgeAssignment).toHaveBeenCalledWith("fall-2026", id)
  })
  it("rejects malformed assignment IDs before any data reads", async () => {
    notFound.mockImplementation(() => {
      throw new Error("Not found")
    })
    await expect(
      JudgeAssignmentPage({
        ...props,
        params: Promise.resolve({
          eventSlug: "fall-2026",
          assignmentId: "bad-id",
        }),
      })
    ).rejects.toThrow("Not found")
    expect(getJudgeEvent).not.toHaveBeenCalled()
  })
})
