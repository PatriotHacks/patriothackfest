import { describe, expect, it } from "vitest"
import { loginReturnPath } from "./login-return-path"

describe("judge and project login destinations", () => {
  it.each([
    "/judge",
    "/judge/",
    "/judge/fall-2026",
    "/projects",
    "/projects/fall-2026/a0000000-0000-4000-8000-000000000001",
  ])("allows implemented local destination %s", (path) => {
    expect(loginReturnPath(path)).toBe(path)
  })
  it.each([
    undefined,
    ["/judge"],
    "https://evil.test",
    "//evil.test",
    "/judge\\evil",
    "/judge/../admins",
    "/judge/%2f%2fevil",
    "/judge?next=//evil.test",
    "/judge#fragment",
    "/judge\n",
    "/judge/fall-2026/not-implemented",
    "/admins",
  ])("rejects unsafe or unimplemented destination %s", (value) => {
    expect(loginReturnPath(value)).toBe("/start")
  })
})
