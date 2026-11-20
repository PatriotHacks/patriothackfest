import { beforeEach, describe, expect, it, vi } from "vitest"
const { getJudgeEvents, getNamedApplicant, redirect } = vi.hoisted(() => ({
  getJudgeEvents: vi.fn(),
  getNamedApplicant: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))
vi.mock("@/lib/judge-access", () => ({ getJudgeEvents }))
vi.mock("@/lib/applicant", () => ({ getNamedApplicant }))
vi.mock("next/navigation", () => ({ redirect }))
import StartPage from "./page"

beforeEach(() => vi.clearAllMocks())
describe("start routing", () => {
  it("sends judges to the judging portal before the name check", async () => {
    getJudgeEvents.mockResolvedValue([{ slug: "fall-2026" }])
    await expect(StartPage()).rejects.toThrow("redirect:/judge")
    expect(getNamedApplicant).not.toHaveBeenCalled()
  })
  it("continues to the applicant flow for non-judges", async () => {
    getJudgeEvents.mockResolvedValue([])
    getNamedApplicant.mockRejectedValue(new Error("redirect:/welcome"))
    await expect(StartPage()).rejects.toThrow("redirect:/welcome")
  })
})
