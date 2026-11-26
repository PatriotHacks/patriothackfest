import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/app/(judge)/judge/certificate/actions", () => ({
  judgeDocumentUrl: vi.fn(),
}))
import { JudgeDocumentsSection } from "./documents"

const render = (
  documents: {
    certificate_path: string | null
    invitation_letter_path: string | null
  } | null
) =>
  renderToStaticMarkup(
    createElement(JudgeDocumentsSection, {
      eventName: "Fall",
      eventSlug: "fall-2026",
      documents,
    })
  )

describe("judge documents section", () => {
  it("waits for judging to close", () => {
    const html = render(null)
    expect(html).toContain("Fall")
    expect(html).toContain("available here after judging closes")
    expect(html).not.toContain("PDF")
  })
  it("offers the certificate and invitation letter when available", () => {
    const html = render({
      certificate_path: "a.pdf",
      invitation_letter_path: "b.pdf",
    })
    expect(html).toContain('aria-label="View Certificate (PDF)"')
    expect(html).toContain('aria-label="View Invitation letter (PDF)"')
  })
  it("says the certificate is not ready and hides a missing letter", () => {
    const html = render({
      certificate_path: null,
      invitation_letter_path: null,
    })
    expect(html).toContain("Your certificate is not yet available.")
    expect(html).not.toContain("Invitation letter")
  })
})
