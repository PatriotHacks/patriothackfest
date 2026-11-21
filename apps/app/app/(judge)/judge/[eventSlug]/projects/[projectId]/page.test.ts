import { beforeEach, describe, expect, it, vi } from "vitest"
const { getJudgeEvent, getGuestProject, notFound } = vi.hoisted(() => ({
  getJudgeEvent: vi.fn(),
  getGuestProject: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NotFound")
  }),
}))
vi.mock("next/navigation", () => ({ notFound }))
vi.mock("@/lib/judge-access", () => ({ getJudgeEvent }))
vi.mock("@/lib/judge-review-data", () => ({ getGuestProject }))
vi.mock("@/components/judge/project-details", () => ({
  JudgeProjectDetails: () => null,
}))
import GuestProjectPage from "./page"

const id = "a0000000-0000-4000-8000-000000000001"
const props = (projectId = id) =>
  ({
    params: Promise.resolve({ eventSlug: "fall-2026", projectId }),
  }) as Parameters<typeof GuestProjectPage>[0]
const detail = { project: { name: "Project" }, answers: [], team: [] }
beforeEach(() => {
  vi.clearAllMocks()
  getGuestProject.mockResolvedValue(detail)
})
describe("guest project page", () => {
  it("rejects malformed routes before any read", async () => {
    await expect(GuestProjectPage(props("nope"))).rejects.toThrow("NotFound")
    expect(getJudgeEvent).not.toHaveBeenCalled()
  })
  it("is not found for non-guest judges", async () => {
    getJudgeEvent.mockResolvedValue({ name: "Fall", guest: false })
    await expect(GuestProjectPage(props())).rejects.toThrow("NotFound")
    expect(getGuestProject).not.toHaveBeenCalled()
    getJudgeEvent.mockResolvedValue(null)
    await expect(GuestProjectPage(props())).rejects.toThrow("NotFound")
  })
  it("loads the project for guests", async () => {
    getJudgeEvent.mockResolvedValue({ name: "Fall", guest: true })
    await GuestProjectPage(props())
    expect(getGuestProject).toHaveBeenCalledWith("fall-2026", id)
    getGuestProject.mockResolvedValue(null)
    await expect(GuestProjectPage(props())).rejects.toThrow("NotFound")
  })
})
