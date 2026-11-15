import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, getApplicant, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getApplicant: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/applicant", () => ({ getApplicant }))
vi.mock("next/cache", () => ({ revalidatePath }))
import {
  addProjectCollaborator,
  createProject,
  removeProjectCollaborator,
  saveProject,
  withdrawProject,
} from "./actions"

const id = "a0000000-0000-4000-8000-000000000001"
const updatedAt = "2026-11-15T05:00:00.123456+00:00"
const input = {
  projectId: id,
  content: {
    name: "A",
    summary: "B",
    description: "C",
    demo_url: "https://example.com",
  },
  trackIds: [],
  submit: true,
  updatedAt,
}
beforeEach(() => {
  vi.clearAllMocks()
  getApplicant.mockResolvedValue({ supabase: { rpc } })
  rpc.mockResolvedValue({ data: updatedAt, error: null })
})

describe("project mutations", () => {
  it("authenticates every action", async () => {
    await createProject(id)
    await saveProject(input)
    await addProjectCollaborator(id, "a@example.com")
    await removeProjectCollaborator(id, id)
    await withdrawProject(id)
    expect(getApplicant).toHaveBeenCalledTimes(5)
  })
  it("does not write when authentication fails", async () => {
    getApplicant.mockRejectedValue(new Error("Sign in"))
    await expect(createProject(id)).rejects.toThrow("Sign in")
    await expect(saveProject(input)).rejects.toThrow("Sign in")
    expect(rpc).not.toHaveBeenCalled()
  })
  it("submits the current content and tracks atomically, preserving revision precision", async () => {
    expect(await saveProject(input)).toEqual({ error: null, updatedAt })
    expect(rpc).toHaveBeenCalledWith(
      "participant_save_project",
      expect.objectContaining({
        p_project_id: id,
        p_content: expect.objectContaining(input.content),
        p_track_ids: [],
        p_submit: true,
        p_expected_updated_at: updatedAt,
      })
    )
    expect(revalidatePath).toHaveBeenCalledWith("/projects", "layout")
  })
  it("rejects malformed IDs, missing submission fields, and injected ownership", async () => {
    expect((await createProject("bad")).error).toBeTruthy()
    expect(
      (await saveProject({ ...input, content: {} })).fieldErrors?.name
    ).toBeTruthy()
    expect(
      (
        await saveProject({
          ...input,
          content: { ...input.content, owner_user_id: id },
        })
      ).error
    ).toBeTruthy()
    expect((await removeProjectCollaborator(id, "bad")).error).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })
  it("saves incomplete drafts without requiring a reviewable link", async () => {
    expect(
      (await saveProject({ ...input, submit: false, content: {} })).error
    ).toBeNull()
    expect(rpc).toHaveBeenCalledWith(
      "participant_save_project",
      expect.objectContaining({ p_submit: false })
    )
  })
  it("does not report success or revalidate failed saves", async () => {
    rpc.mockResolvedValue({
      error: {
        code: "PT422",
        message: "Needs attention",
        details: '{"track_ids":"Unavailable track"}',
      },
    })
    expect(await saveProject(input)).toEqual({
      error: "Needs attention",
      fieldErrors: { track_ids: "Unavailable track" },
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it("normalizes collaborator addresses and preserves generic database errors", async () => {
    rpc.mockResolvedValue({
      error: { message: "Cannot add this collaborator" },
    })
    expect(
      (await addProjectCollaborator(id, "  Person@Example.com ")).error
    ).toBe("Cannot add this collaborator")
    expect(rpc).toHaveBeenCalledWith("participant_add_project_collaborator", {
      p_project_id: id,
      p_email: "person@example.com",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
