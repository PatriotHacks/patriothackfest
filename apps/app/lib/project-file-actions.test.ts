import { beforeEach, describe, expect, it, vi } from "vitest"
const { createSignedUrl, from, getApplicant } = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  from: vi.fn(),
  getApplicant: vi.fn(),
}))
vi.mock("./applicant", () => ({ getApplicant }))
import { projectFileUrl } from "./project-file-actions"

const path =
  "a0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000001.pdf"
beforeEach(() => {
  vi.clearAllMocks()
  from.mockReturnValue({ createSignedUrl })
  getApplicant.mockResolvedValue({ supabase: { storage: { from } } })
})

describe("project file links", () => {
  it("signs a 60-second link with the caller's session", async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.test/file" },
      error: null,
    })
    expect(await projectFileUrl(path)).toEqual({
      error: null,
      url: "https://signed.test/file",
    })
    expect(from).toHaveBeenCalledWith("project-files")
    expect(createSignedUrl).toHaveBeenCalledWith(path, 60)
  })
  it("reports storage policy denials", async () => {
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    })
    expect(await projectFileUrl(path)).toEqual({ error: "Object not found" })
  })
  it("rejects empty paths without calling storage", async () => {
    expect(await projectFileUrl("")).toEqual({ error: "File not found" })
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
