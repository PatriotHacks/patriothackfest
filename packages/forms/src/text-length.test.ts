import { describe, expect, it } from "vitest"

import { countWords, textLength } from "./text-length"

describe("countWords", () => {
  it("counts whitespace-separated runs", () => {
    expect(countWords("one two  three")).toBe(3)
    expect(countWords("  one\ttwo\nthree \r\n")).toBe(3)
    expect(countWords("don't stop-me now.")).toBe(3)
  })

  it("treats empty and whitespace-only text as zero words", () => {
    expect(countWords("")).toBe(0)
    expect(countWords(" \t\n ")).toBe(0)
    expect(countWords(" 　﻿")).toBe(0)
  })

  it("splits on Unicode whitespace", () => {
    expect(countWords("one two three　four")).toBe(4)
  })
})

describe("textLength", () => {
  it("counts trimmed code points for characters", () => {
    expect(textLength("  héllo  ", "characters")).toBe(5)
    expect(textLength("😀😀", "characters")).toBe(2)
  })

  it("counts words for words", () => {
    expect(textLength("  hello world  ", "words")).toBe(2)
  })
})
