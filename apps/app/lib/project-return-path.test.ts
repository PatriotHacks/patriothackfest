import { describe, expect, it } from "vitest"
import { projectReturnPath } from "./project-return-path"

describe("project login return path", () => {
  it.each([
    "/projects",
    "/projects/fall-2026",
    "/projects/fall-2026/a0000000-0000-4000-8000-000000000001",
  ])("allows %s", (path) => {
    expect(projectReturnPath(path)).toBe(path)
  })
  it.each([
    undefined,
    ["/projects"],
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/projects/../../admins",
    "/projects/%2f%2fevil.test",
    "/projects?next=https://evil.test",
    "/projects#fragment",
    "/judge",
    "/projects\n",
  ])("rejects non-project or unsafe return target %s", (value) => {
    expect(projectReturnPath(value)).toBe("/start")
  })
})
