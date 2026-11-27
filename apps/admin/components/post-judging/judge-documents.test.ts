import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(admin)/post-judging/actions", () => ({
  judgeDocumentUrl: vi.fn(),
  saveInvitationLetter: vi.fn(),
  saveJudgeCertificate: vi.fn(),
  setJudgeInvitation: vi.fn(),
}))
import { InvitationLetter, JudgeDocuments } from "./judge-documents"
import type { PostJudgingJudge } from "@/lib/judge-documents"

const eventId = "a0000000-0000-4000-8000-000000000001"
const judge: PostJudgingJudge = {
  id: "b0000000-0000-4000-8000-000000000001",
  email: "one@example.com",
  guest: false,
  receives_invitation: true,
  certificate_path: `${eventId}/certificates/b0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000001.pdf`,
}
const other: PostJudgingJudge = {
  ...judge,
  id: "b0000000-0000-4000-8000-000000000002",
  email: "two@example.com",
  guest: true,
  receives_invitation: false,
  certificate_path: null,
}

describe("judge documents table", () => {
  it("shows each judge's certificate status, controls and invitation switch", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeDocuments, { eventId, judges: [judge, other] })
    )
    expect(html).toContain('aria-label="Judge documents"')
    expect(html).toContain('aria-label="View Certificate for one@example.com"')
    expect(html).toContain(
      'aria-label="Remove Certificate for one@example.com"'
    )
    expect(html).toContain("Replace Certificate for one@example.com")
    expect(html).toContain("Not uploaded")
    expect(html).toContain("Upload Certificate for two@example.com")
    expect(html).not.toContain("Remove Certificate for two@example.com")
    expect(html).toContain("Guest")
    expect(html).toMatch(
      /aria-checked="true"[^>]*aria-label="Invitation letter for one@example.com"/
    )
    expect(html).toMatch(
      /aria-checked="false"[^>]*aria-label="Invitation letter for two@example.com"/
    )
    expect(html).toContain('accept="application/pdf"')
  })
  it("says when the event has no active judges", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeDocuments, { eventId, judges: [] })
    )
    expect(html).toContain("No active judges for this event.")
  })
})

describe("invitation letter", () => {
  it("offers an upload when none is recorded and view/remove when one is", () => {
    const empty = renderToStaticMarkup(
      createElement(InvitationLetter, { eventId, path: null })
    )
    expect(empty).toContain("Not uploaded")
    expect(empty).toContain("Upload Invitation letter")
    const uploaded = renderToStaticMarkup(
      createElement(InvitationLetter, {
        eventId,
        path: `${eventId}/invitation-letter/c0000000-0000-4000-8000-000000000001.pdf`,
      })
    )
    expect(uploaded).toContain('aria-label="View Invitation letter"')
    expect(uploaded).toContain('aria-label="Remove Invitation letter"')
  })
})
