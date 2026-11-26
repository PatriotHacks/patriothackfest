import { beforeEach, describe, expect, it, vi } from "vitest"
const { getApplicant, getJudgeDocuments, createSignedUrl, from } = vi.hoisted(
  () => ({
    getApplicant: vi.fn(),
    getJudgeDocuments: vi.fn(),
    createSignedUrl: vi.fn(),
    from: vi.fn(),
  })
)
vi.mock("@/lib/applicant", () => ({ getApplicant }))
vi.mock("@/lib/judge-documents", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getJudgeDocuments,
}))
vi.mock("server-only", () => ({}))
import { judgeDocumentUrl } from "./actions"

const certificate = "a/certificates/b/c.pdf"
const letter = "a/invitation-letter/c.pdf"
beforeEach(() => {
  vi.clearAllMocks()
  from.mockReturnValue({ createSignedUrl })
  getApplicant.mockResolvedValue({ supabase: { storage: { from } } })
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://signed.test/file" },
    error: null,
  })
  getJudgeDocuments.mockResolvedValue({
    certificate_path: certificate,
    invitation_letter_path: null,
  })
})

describe("judge document links", () => {
  it("signs the caller's certificate for 60 seconds", async () => {
    expect(
      await judgeDocumentUrl({ eventSlug: "fall-2026", kind: "certificate" })
    ).toEqual({ error: null, url: "https://signed.test/file" })
    expect(getJudgeDocuments).toHaveBeenCalledWith("fall-2026")
    expect(from).toHaveBeenCalledWith("judge-documents")
    expect(createSignedUrl).toHaveBeenCalledWith(certificate, 60)
  })
  it("signs the invitation letter only when the RPC returns it", async () => {
    expect(
      await judgeDocumentUrl({
        eventSlug: "fall-2026",
        kind: "invitation_letter",
      })
    ).toEqual({ error: "File not found" })
    expect(createSignedUrl).not.toHaveBeenCalled()
    getJudgeDocuments.mockResolvedValue({
      certificate_path: null,
      invitation_letter_path: letter,
    })
    await judgeDocumentUrl({
      eventSlug: "fall-2026",
      kind: "invitation_letter",
    })
    expect(createSignedUrl).toHaveBeenCalledWith(letter, 60)
  })
  it("returns not found for non-judges and invalid input", async () => {
    getJudgeDocuments.mockResolvedValue(null)
    expect(
      await judgeDocumentUrl({ eventSlug: "fall-2026", kind: "certificate" })
    ).toEqual({ error: "File not found" })
    expect(
      await judgeDocumentUrl({ eventSlug: "fall-2026", kind: "path" })
    ).toEqual({ error: "File not found" })
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
