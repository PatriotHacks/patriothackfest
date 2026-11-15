import { beforeEach, describe, expect, it, vi } from "vitest"
const { getAdmin, getSubmittedProject, redirect } = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  getSubmittedProject: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("Redirect to forms")
  }),
}))
vi.mock("@/lib/admin", () => ({ getAdmin }))
vi.mock("@/lib/organizer-project-data", () => ({ getSubmittedProject }))
vi.mock("next/navigation", () => ({ redirect }))
import SubmittedProjectPage from "./page"

const id = "a0000000-0000-4000-8000-000000000001"
beforeEach(() => {
  vi.clearAllMocks()
  getAdmin.mockResolvedValue({ level: "organizer" })
  getSubmittedProject.mockResolvedValue({
    event: { slug: "fall-2026", name: "Fall" },
    detail: { project: { id } },
  })
})

describe("organizer project detail route", () => {
  it("redirects reviewers before querying project data", async () => {
    getAdmin.mockResolvedValue({ level: "reviewer" })
    await expect(
      SubmittedProjectPage({
        params: Promise.resolve({ projectId: id }),
        searchParams: Promise.resolve({ event: "fall-2026" }),
      })
    ).rejects.toThrow("Redirect to forms")
    expect(redirect).toHaveBeenCalledWith("/forms")
    expect(getSubmittedProject).not.toHaveBeenCalled()
  })
  it("passes exact URL identity and retains the selected page", async () => {
    const result = await SubmittedProjectPage({
      params: Promise.resolve({ projectId: id }),
      searchParams: Promise.resolve({ event: "fall-2026", projectsPage: "2" }),
    })
    expect(getSubmittedProject).toHaveBeenCalledWith("fall-2026", id)
    expect(result.props.page).toBe(2)
  })
})
