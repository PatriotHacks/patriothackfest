import { beforeEach, describe, expect, it, vi } from "vitest"
const { getApplicant, rpc } = vi.hoisted(() => ({
  getApplicant: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/applicant", () => ({ getApplicant }))
import {
  getGuestProject,
  getGuestProjects,
  getJudgeAssignment,
  getJudgeQueue,
} from "./judge-review-data"
beforeEach(() => {
  vi.clearAllMocks()
  getApplicant.mockResolvedValue({ supabase: { rpc } })
})
describe("private judge reads", () => {
  it("uses caller-scoped RPCs and distinguishes denial", async () => {
    rpc.mockResolvedValue({
      data: { total: 0, completed: 0, assignments: [] },
      error: null,
    })
    expect(await getJudgeQueue("fall-2026")).toEqual({
      total: 0,
      completed: 0,
      assignments: [],
    })
    expect(rpc).toHaveBeenCalledWith("judge_queue", {
      p_event_slug: "fall-2026",
    })
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await getJudgeAssignment("fall-2026", "id")).toBeNull()
  })
  it("does not disguise deployment or parsing errors as empty queues", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Missing RPC" } })
    await expect(getJudgeQueue("fall-2026")).rejects.toThrow("Missing RPC")
    rpc.mockResolvedValue({ data: {}, error: null })
    await expect(getJudgeQueue("fall-2026")).rejects.toThrow()
  })
  it("reads guest projects through guest-only RPCs", async () => {
    const id = "a0000000-0000-4000-8000-000000000001"
    rpc.mockResolvedValue({ data: [{ id, name: "Project" }], error: null })
    expect(await getGuestProjects("fall-2026")).toEqual([
      { id, name: "Project" },
    ])
    expect(rpc).toHaveBeenCalledWith("judge_guest_projects", {
      p_event_slug: "fall-2026",
    })
    const detail = { project: { name: "Project" }, answers: [], team: [] }
    rpc.mockResolvedValue({ data: detail, error: null })
    expect(await getGuestProject("fall-2026", id)).toEqual(detail)
    expect(rpc).toHaveBeenCalledWith("judge_guest_project", {
      p_event_slug: "fall-2026",
      p_project_id: id,
    })
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await getGuestProjects("fall-2026")).toBeNull()
    expect(await getGuestProject("fall-2026", id)).toBeNull()
  })
})
