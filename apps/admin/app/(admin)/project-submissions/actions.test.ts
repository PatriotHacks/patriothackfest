import { beforeEach, describe, expect, it, vi } from "vitest"

const { createSignedUrl, requireAdmin } = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))

import { projectFileUrl } from "./actions"

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({
    supabase: { storage: { from: () => ({ createSignedUrl }) } },
  })
})

describe("organizer project file links", () => {
  const projectId = "f0000000-0000-4000-8000-000000000001"
  const questionId = "d0000000-0000-4000-8000-000000000001"
  const fileId = "d0000000-0000-4000-8000-000000000002"
  const path = `${projectId}/${questionId}/${fileId}.pdf`
  it("signs project files for organizers only", async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.test/deck" },
      error: null,
    })
    expect(await projectFileUrl(path)).toEqual({
      error: null,
      url: "https://signed.test/deck",
    })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(createSignedUrl).toHaveBeenCalledWith(path, 60)
  })
  it("rejects empty paths and reports storage denials", async () => {
    expect(await projectFileUrl("")).toEqual({ error: "File not found" })
    expect(createSignedUrl).not.toHaveBeenCalled()
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    })
    expect(await projectFileUrl(path)).toEqual({ error: "Object not found" })
  })
  it("does not sign when authorization fails", async () => {
    requireAdmin.mockRejectedValue(new Error("Forbidden"))
    await expect(projectFileUrl(path)).rejects.toThrow("Forbidden")
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
