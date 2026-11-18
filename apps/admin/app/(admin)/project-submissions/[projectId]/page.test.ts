import { beforeEach, describe, expect, it, vi } from "vitest"
const { getAdmin, getProject, redirect } = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  getProject: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("Redirect to forms")
  }),
}))
vi.mock("@/lib/admin", () => ({ getAdmin }))
vi.mock("@/lib/organizer-project-data", () => ({ getProject }))
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/components/project-submissions/project-details", () => ({
  ProjectDetails: () => null,
}))
import ProjectPage from "./page"

const id = "a0000000-0000-4000-8000-000000000001"
beforeEach(() => {
  vi.clearAllMocks()
  getAdmin.mockResolvedValue({ level: "organizer" })
  getProject.mockResolvedValue({
    event: { slug: "fall-2026", name: "Fall" },
    detail: { project: { id } },
  })
})

describe("organizer project detail route", () => {
  it("redirects reviewers before querying project data", async () => {
    getAdmin.mockResolvedValue({ level: "reviewer" })
    await expect(
      ProjectPage({
        params: Promise.resolve({ projectId: id }),
        searchParams: Promise.resolve({ event: "fall-2026" }),
      })
    ).rejects.toThrow("Redirect to forms")
    expect(redirect).toHaveBeenCalledWith("/forms")
    expect(getProject).not.toHaveBeenCalled()
  })
  it("passes exact URL identity and retains the selected status and page", async () => {
    const result = await ProjectPage({
      params: Promise.resolve({ projectId: id }),
      searchParams: Promise.resolve({
        event: "fall-2026",
        status: "draft",
        projectsPage: "2",
      }),
    })
    expect(getProject).toHaveBeenCalledWith("fall-2026", id)
    expect(result.props.query).toEqual({ status: "draft", page: 2 })
  })
})
