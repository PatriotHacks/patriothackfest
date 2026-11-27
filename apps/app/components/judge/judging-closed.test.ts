import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { JudgingClosedNotice } from "./judging-closed"

describe("judging closed notice", () => {
  it("thanks the judge and links to the certificate page", () => {
    const html = renderToStaticMarkup(createElement(JudgingClosedNotice))
    expect(html).toContain("Judging has closed. Thank you for judging!")
    expect(html).toContain('href="/judge/certificate"')
    expect(html).not.toContain("<h2")
  })
  it("titles the notice when given a title", () => {
    const html = renderToStaticMarkup(
      createElement(JudgingClosedNotice, { title: "Fall scoring criteria" })
    )
    expect(html).toContain("Fall scoring criteria")
  })
})
