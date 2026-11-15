import { describe, expect, it } from "vitest"
import { projectNavigationLeavesPage } from "./project-navigation"
describe("unsaved project navigation", () => {
  const current = "http://localhost:3001/projects/fall-2026/project-id"
  it("guards internal navigation, including sidebar/back-to-list links", () => {
    expect(projectNavigationLeavesPage("/projects/fall-2026", current)).toBe(
      true
    )
    expect(projectNavigationLeavesPage("/", current)).toBe(true)
    expect(projectNavigationLeavesPage("?other=1", current)).toBe(true)
  })
  it("leaves external URLs to beforeunload and does not warn for same-page anchors", () => {
    expect(projectNavigationLeavesPage("https://example.com", current)).toBe(
      false
    )
    expect(projectNavigationLeavesPage("#details", current)).toBe(false)
    expect(projectNavigationLeavesPage(current, current)).toBe(false)
  })
})
