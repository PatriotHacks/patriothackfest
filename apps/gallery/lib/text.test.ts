import { describe, expect, it } from "vitest"

import { truncate } from "./text"

describe("truncate", () => {
  it("returns short text unchanged after collapsing whitespace", () => {
    expect(truncate("  hello \n world ", 20)).toBe("hello world")
  })

  it("cuts at a word boundary with an ellipsis", () => {
    expect(truncate("one two three four five", 12)).toBe("one two…")
  })
})
