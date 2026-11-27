import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
const {
  getJudgeEvents,
  getNamedApplicant,
  getSubmittedApplications,
  redirect,
} = vi.hoisted(() => ({
  getJudgeEvents: vi.fn(),
  getNamedApplicant: vi.fn(),
  getSubmittedApplications: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))
vi.mock("@/lib/judge-access", () => ({ getJudgeEvents }))
vi.mock("@/lib/applicant", () => ({
  getNamedApplicant,
  getSubmittedApplications,
}))
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}))
vi.mock("@workspace/ui/components/sidebar", () => ({
  SidebarInset: () => null,
  SidebarProvider: () => null,
  SidebarTrigger: () => null,
}))
vi.mock("@/components/logo-lockup", () => ({ LogoLockup: () => null }))
vi.mock("@/components/applicant-sidebar", () => ({
  ApplicantSidebar: () => null,
}))
vi.mock("@/components/judge-sidebar", () => ({ JudgeSidebar: () => null }))
import { ApplicantSidebar } from "@/components/applicant-sidebar"
import { JudgeSidebar } from "@/components/judge-sidebar"
import MainLayout from "./layout"

const application = {
  id: "app-1",
  role: "participant",
  events: {
    starts_at: "2026-11-14T05:00:00Z",
    ends_at: "2026-11-26T04:59:59Z",
  },
}

async function sidebar() {
  const tree = (await MainLayout({
    children: null,
    params: Promise.resolve({}),
  } as never)) as ReactElement<{ children: ReactElement[] }>
  return tree.props.children[0]!
}

beforeEach(() => {
  vi.clearAllMocks()
  getNamedApplicant.mockResolvedValue({ email: "person@example.com" })
})
describe("participant layout routing", () => {
  it("keeps dual-role users in the judge shell with their application link", async () => {
    getJudgeEvents.mockResolvedValue([{ slug: "fall-2026" }])
    getSubmittedApplications.mockResolvedValue([application])
    const nav = await sidebar()
    expect(nav.type).toBe(JudgeSidebar)
    expect(nav.props).toMatchObject({
      applicationId: "app-1",
      judgingClosed: false,
    })
  })
  it("tells the judge shell once every event's judging has closed", async () => {
    getJudgeEvents.mockResolvedValue([
      { slug: "fall-2026", judging_close_at: "2026-01-01T00:00:00Z" },
    ])
    getSubmittedApplications.mockResolvedValue([application])
    const nav = await sidebar()
    expect(nav.props).toMatchObject({ judgingClosed: true })
  })
  it("sends judges without a submitted application to the judging portal", async () => {
    getJudgeEvents.mockResolvedValue([{ slug: "fall-2026" }])
    getSubmittedApplications.mockResolvedValue([])
    await expect(sidebar()).rejects.toThrow("redirect:/judge")
  })
  it("keeps participants in the applicant shell", async () => {
    getJudgeEvents.mockResolvedValue([])
    getSubmittedApplications.mockResolvedValue([application])
    const nav = await sidebar()
    expect(nav.type).toBe(ApplicantSidebar)
    expect(nav.props).toMatchObject({
      applicationId: "app-1",
      view: "participant",
    })
  })
  it("sends participants without a submitted application to /start", async () => {
    getJudgeEvents.mockResolvedValue([])
    getSubmittedApplications.mockResolvedValue([])
    await expect(sidebar()).rejects.toThrow("redirect:/start")
  })
})
