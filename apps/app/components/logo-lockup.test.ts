import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LogoLockup } from "./logo-lockup"

describe("logo lockup", () => {
  it("shows the participant view label as text beside the logo", () => {
    const html = renderToStaticMarkup(
      createElement(LogoLockup, { view: "participant", imageClassName: "h-8" })
    )
    expect(html).toContain('alt="Patriot HackFest"')
    expect(html).toContain(">Participant</span>")
  })
  it("shows the judging view label", () => {
    const html = renderToStaticMarkup(
      createElement(LogoLockup, { view: "judging", imageClassName: "h-8" })
    )
    expect(html).toContain(">Judging</span>")
    expect(html).not.toContain("Participant")
  })
})
