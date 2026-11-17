import { describe, expect, it } from "vitest"

import {
  countWords,
  formatLength,
  limitForUnit,
  textLength,
} from "./text-length"

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

describe("formatLength", () => {
  it("uses the singular for one", () => {
    expect(formatLength(1, "words")).toBe("1 word")
    expect(formatLength(1, "characters")).toBe("1 character")
    expect(formatLength(0, "words")).toBe("0 words")
    expect(formatLength(300, "characters")).toBe("300 characters")
  })
})

describe("limitForUnit", () => {
  it("clamps limits to the word cap only for words", () => {
    expect(limitForUnit(5000, "words")).toBe(1500)
    expect(limitForUnit(300, "words")).toBe(300)
    expect(limitForUnit(5000, "characters")).toBe(5000)
  })
})
