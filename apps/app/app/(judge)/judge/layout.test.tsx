import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
const { getApplicant, getJudgeEvents, getSubmittedApplications } = vi.hoisted(
  () => ({
    getApplicant: vi.fn(),
    getJudgeEvents: vi.fn(),
    getSubmittedApplications: vi.fn(),
  })
)
vi.mock("@/lib/judge-access", () => ({ getJudgeEvents }))
vi.mock("@/lib/applicant", () => ({ getApplicant, getSubmittedApplications }))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}))
vi.mock("@workspace/ui/components/sidebar", () => ({
  SidebarInset: () => null,
  SidebarProvider: () => null,
  SidebarTrigger: () => null,
}))
vi.mock("@/components/logo-lockup", () => ({ LogoLockup: () => null }))
vi.mock("@/components/judge-sidebar", () => ({ JudgeSidebar: () => null }))
import JudgeLayout from "./layout"

const closed = { judging_close_at: "2026-01-01T00:00:00Z" }
const open = { judging_close_at: "2999-01-01T00:00:00Z" }

async function sidebar() {
  const tree = (await JudgeLayout({ children: null })) as ReactElement<{
    children: ReactElement<{ judgingClosed: boolean }>[]
  }>
  return tree.props.children[0]!
}

beforeEach(() => {
  vi.clearAllMocks()
  getApplicant.mockResolvedValue({ email: "judge@example.com" })
  getSubmittedApplications.mockResolvedValue([])
})
describe("judge layout sidebar", () => {
  it("keeps review links while any event is still open", async () => {
    getJudgeEvents.mockResolvedValue([closed, open])
    expect((await sidebar()).props.judgingClosed).toBe(false)
  })
  it("hides review links once every event has closed", async () => {
    getJudgeEvents.mockResolvedValue([closed])
    expect((await sidebar()).props.judgingClosed).toBe(true)
  })
})
