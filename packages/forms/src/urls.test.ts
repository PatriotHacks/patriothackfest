import { describe, expect, it } from "vitest"

import { safeHttpUrl } from "./urls"

describe("safeHttpUrl", () => {
  it.each([
    null,
    undefined,
    "",
    "javascript:alert(1)",
    "data:text/html,hello",
    "//example.com",
    "https://",
    "https://a b.test",
    "https://user:pass@example.com",
    "https://example.com:invalid",
    "https:\\example.com",
    "https://example.test\\bad",
  ])("does not link unsafe URL %s", (value) => {
    expect(safeHttpUrl(value)).toBeNull()
  })
  it("allows ordinary HTTP(S) links as written", () => {
    expect(safeHttpUrl(" https://example.com/demo ")).toBe(
      "https://example.com/demo"
    )
    expect(safeHttpUrl("http://localhost:3000")).toBe("http://localhost:3000")
  })
})
