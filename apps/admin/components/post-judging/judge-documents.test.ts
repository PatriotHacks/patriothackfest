import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/post-judging/actions", () => ({
  judgeDocumentUrl: vi.fn(),
  saveJudgeCertificate: vi.fn(),
  saveJudgeInvitationLetter: vi.fn(),
}))
import { JudgeDocuments } from "./judge-documents"
import type { PostJudgingJudge } from "@/lib/judge-documents"

const eventId = "a0000000-0000-4000-8000-000000000001"
const judge: PostJudgingJudge = {
  id: "b0000000-0000-4000-8000-000000000001",
  email: "one@example.com",
  guest: false,
  certificate_path: `${eventId}/certificates/b0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000001.pdf`,
  invitation_letter_path: `${eventId}/invitation-letters/b0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000002.pdf`,
}
const other: PostJudgingJudge = {
  ...judge,
  id: "b0000000-0000-4000-8000-000000000002",
  email: "two@example.com",
  guest: true,
  certificate_path: null,
  invitation_letter_path: null,
}

describe("judge documents table", () => {
  it("shows each judge's certificate and invitation letter controls", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeDocuments, { eventId, judges: [judge, other] })
    )
    expect(html).toContain('aria-label="Judge documents"')
    for (const label of ["Certificate", "Invitation letter"]) {
      expect(html).toContain(`aria-label="View ${label} for one@example.com"`)
      expect(html).toContain(
        `aria-label="Remove ${label} for one@example.com"`
      )
      expect(html).toContain(`Replace ${label} for one@example.com`)
      expect(html).toContain(`Upload ${label} for two@example.com`)
      expect(html).not.toContain(`Remove ${label} for two@example.com`)
    }
    expect(html).toContain("Not uploaded")
    expect(html).toContain("Guest")
    expect(html).not.toContain('role="switch"')
    expect(html).toContain('accept="application/pdf"')
  })
  it("uses outline buttons for uploads", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeDocuments, { eventId, judges: [other] })
    )
    expect(html).toMatch(
      /<button[^>]*data-variant="outline"[^>]*aria-label="Upload Certificate for two@example.com"[^>]*>Upload<\/button>/
    )
    expect(html).toMatch(
      /<button[^>]*data-variant="outline"[^>]*aria-label="Upload Invitation letter for two@example.com"[^>]*>Upload<\/button>/
    )
  })
  it("says when the event has no active judges", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeDocuments, { eventId, judges: [] })
    )
    expect(html).toContain("No active judges for this event.")
  })
})
