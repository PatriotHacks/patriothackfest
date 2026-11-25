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
vi.mock("@/components/application/decline-button", () => ({
  DeclineButton: () => null,
}))
vi.mock("@/components/application/withdraw-button", () => ({
  WithdrawButton: () => null,
}))
import DashboardPage from "./page"

beforeEach(() => vi.clearAllMocks())
describe("dashboard routing", () => {
  it("sends dual-role users to the judging portal", async () => {
    getJudgeEvents.mockResolvedValue([{ slug: "fall-2026" }])
    await expect(DashboardPage()).rejects.toThrow("redirect:/judge")
    expect(getNamedApplicant).not.toHaveBeenCalled()
  })
  it("renders the dashboard for participants", async () => {
    getJudgeEvents.mockResolvedValue([])
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const query = { select: () => query, eq: () => query, order }
    getNamedApplicant.mockResolvedValue({
      supabase: { from: () => query },
      userId: "user-1",
      fullName: "Pat",
    })
    await expect(DashboardPage()).resolves.toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })
})
