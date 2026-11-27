import { beforeEach, describe, expect, it, vi } from "vitest"
const { getApplicant, rpc } = vi.hoisted(() => ({
  getApplicant: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("./applicant", () => ({ getApplicant }))
import { getJudgeDocuments, judgeDocumentInput } from "./judge-documents"

beforeEach(() => {
  vi.clearAllMocks()
  getApplicant.mockResolvedValue({ supabase: { rpc } })
})

describe("judge documents", () => {
  it("reads the caller's documents for the event", async () => {
    const documents = {
      certificate_path: "a.pdf",
      invitation_letter_path: null,
    }
    rpc.mockResolvedValue({ data: documents, error: null })
    expect(await getJudgeDocuments("fall-2026")).toEqual(documents)
    expect(rpc).toHaveBeenCalledWith("judge_documents", {
      p_event_slug: "fall-2026",
    })
  })
  it("returns null for non-judges and throws on errors", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await getJudgeDocuments("fall-2026")).toBeNull()
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } })
    await expect(getJudgeDocuments("fall-2026")).rejects.toThrow("boom")
  })
  it("accepts only known document kinds and valid slugs", () => {
    const valid = { eventSlug: "fall-2026", kind: "certificate" }
    expect(judgeDocumentInput.safeParse(valid).success).toBe(true)
    expect(
      judgeDocumentInput.safeParse({ ...valid, kind: "other" }).success
    ).toBe(false)
    expect(
      judgeDocumentInput.safeParse({ ...valid, eventSlug: "../x" }).success
    ).toBe(false)
  })
})
