import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { GuestProjectList } from "./guest-projects"
const id = "a0000000-0000-4000-8000-000000000001"
describe("guest project list", () => {
  it("links each project to its read-only view", () => {
    const html = renderToStaticMarkup(
      createElement(GuestProjectList, {
        eventSlug: "fall-2026",
        projects: [{ id, name: "<b>Project</b>" }],
      })
    )
    expect(html).toContain(`href="/judge/fall-2026/projects/${id}"`)
    expect(html).toContain("&lt;b&gt;Project&lt;/b&gt;")
  })
  it("says when there are no projects", () => {
    const html = renderToStaticMarkup(
      createElement(GuestProjectList, { eventSlug: "fall-2026", projects: [] })
    )
    expect(html).toContain("No submitted projects.")
  })
})
