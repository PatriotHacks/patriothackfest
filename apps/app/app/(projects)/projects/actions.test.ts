import { beforeEach, describe, expect, it, vi } from "vitest"
const { rpc, remove, getApplicant, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  remove: vi.fn(),
  getApplicant: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/applicant", () => ({ getApplicant }))
vi.mock("next/cache", () => ({ revalidatePath }))
import { STALE_PROJECT_MESSAGE } from "@/lib/projects"
import {
  addProjectCollaborator,
  createProject,
  leaveProject,
  removeProjectCollaborator,
  saveProject,
} from "./actions"

const id = "a0000000-0000-4000-8000-000000000001"
const questionId = "b0000000-0000-4000-8000-000000000001"
const updatedAt = "2026-11-15T05:00:00.123456+00:00"
const input = {
  projectId: id,
  eventId: id,
  content: { name: "A" },
  answers: { [questionId]: " Answer " },
  trackIds: [],
  submit: true,
  updatedAt,
}
beforeEach(() => {
  vi.clearAllMocks()
  getApplicant.mockResolvedValue({
    supabase: { rpc, storage: { from: () => ({ remove }) } },
  })
  rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name === "participant_project_detail"
        ? { data: null, error: null }
        : { data: updatedAt, error: null }
    )
  )
})

describe("project mutations", () => {
  it("authenticates every action", async () => {
    await createProject(id)
    await saveProject(input)
    await addProjectCollaborator(id, "a@example.com")
    await removeProjectCollaborator(id, id)
    await leaveProject(id)
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
        p_answers: { [questionId]: "Answer" },
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
    expect(
      (await saveProject({ ...input, answers: { "not-a-question": "x" } }))
        .error
    ).toBeTruthy()
    expect((await removeProjectCollaborator(id, "bad")).error).toBeTruthy()
    expect((await leaveProject("bad")).error).toBeTruthy()
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
        details: `{"track_ids":"Unavailable track","answers.${questionId}":"This question is required"}`,
      },
    })
    expect(await saveProject(input)).toEqual({
      error: "Needs attention",
      fieldErrors: {
        track_ids: "Unavailable track",
        [`answers.${questionId}`]: "This question is required",
      },
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
  it("leaves a team and surfaces the owner restriction", async () => {
    expect(await leaveProject(id)).toEqual({ error: null })
    expect(rpc).toHaveBeenCalledWith("participant_leave_project", {
      p_project_id: id,
    })
    rpc.mockResolvedValue({
      error: { message: "The project owner cannot leave the team" },
    })
    expect((await leaveProject(id)).error).toBe(
      "The project owner cannot leave the team"
    )
  })
})

describe("replaced project files", () => {
  const fileQuestion = "b0000000-0000-4000-8000-000000000002"
  const file = (n: number) => ({
    path: `${id}/${fileQuestion}/c0000000-0000-4000-8000-00000000000${n}.pdf`,
    name: "deck.pdf",
    size: 1,
    type: "application/pdf",
  })
  const stored = (answers: Record<string, unknown>) => ({
    project: {
      id,
      event_id: id,
      owner_user_id: id,
      name: "",
      status: "draft",
      submitted_at: null,
      updated_at: updatedAt,
      answers,
    },
    owner: { user_id: id, full_name: "Owner" },
    collaborators: [],
    max_team_size: null,
    selected_tracks: [],
    available_tracks: [],
    questions: [],
  })
  const respond = (detail: unknown, save: unknown) =>
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === "participant_project_detail"
          ? { data: detail, error: null }
          : save
      )
    )

  it("deletes files the saved answers no longer reference", async () => {
    respond(stored({ [fileQuestion]: file(1) }), {
      data: updatedAt,
      error: null,
    })
    await saveProject({ ...input, answers: { [fileQuestion]: file(2) } })
    expect(rpc).toHaveBeenCalledWith("participant_project_detail", {
      p_project_id: id,
      p_event_id: id,
    })
    expect(remove).toHaveBeenCalledWith([file(1).path])
  })
  it("keeps files that are still referenced", async () => {
    respond(stored({ [fileQuestion]: file(1) }), {
      data: updatedAt,
      error: null,
    })
    await saveProject({ ...input, answers: { [fileQuestion]: file(1) } })
    expect(remove).not.toHaveBeenCalled()
  })
  it("deletes nothing when the save fails", async () => {
    respond(stored({ [fileQuestion]: file(1) }), {
      data: null,
      error: { code: "PT409", message: "This project changed." },
    })
    expect(await saveProject({ ...input, answers: {} })).toEqual({
      error: STALE_PROJECT_MESSAGE,
      stale: true,
    })
    expect(remove).not.toHaveBeenCalled()
  })
})
