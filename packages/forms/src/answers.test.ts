import { describe, expect, it } from "vitest"

import { validateAnswers } from "./answers"
import type { Field } from "./schema"
import { field, section } from "./test-utils"

function errorFor(f: Field, value: unknown) {
  return validateAnswers(
    { fields: [f] },
    { [f.id]: value },
    { mode: "submit" }
  )[f.id]
}

describe("validateAnswers", () => {
  it("requires visible required fields only on submit", () => {
    const name = field("short_text", { required: true })
    expect(validateAnswers({ fields: [name] }, {}, { mode: "submit" })).toEqual(
      {
        [name.id]: "Required",
      }
    )
    expect(validateAnswers({ fields: [name] }, {}, { mode: "draft" })).toEqual(
      {}
    )
    expect(
      validateAnswers(
        { fields: [name] },
        { [name.id]: "  " },
        { mode: "submit" }
      )
    ).toEqual({ [name.id]: "Required" })
  })

  it("does not require hidden fields", () => {
    const size = field("single_choice", { options: ["S", "XL"] })
    const why = field("long_text", {
      required: true,
      condition: { field_id: size.id, operator: "equals", value: "XL" },
    })
    const schema = { fields: [size, why] }
    expect(
      validateAnswers(schema, { [size.id]: "S" }, { mode: "submit" })
    ).toEqual({})
    expect(
      validateAnswers(schema, { [size.id]: "XL" }, { mode: "submit" })
    ).toEqual({
      [why.id]: "Required",
    })
  })

  it("requires a required checkbox to be checked", () => {
    const agree = field("checkbox", { required: true })
    expect(errorFor(agree, false)).toBe("Required")
    expect(errorFor(agree, true)).toBeUndefined()
  })

  it("still checks formats in draft mode", () => {
    const email = field("email")
    expect(
      validateAnswers(
        { fields: [email] },
        { [email.id]: "nope" },
        { mode: "draft" }
      )
    ).toEqual({ [email.id]: "Enter a valid email address" })
  })

  it("validates text length", () => {
    const bio = field("long_text", {
      validation: { min_length: 3, max_length: 5 },
    })
    expect(errorFor(bio, "ab")).toBe("Enter at least 3 characters")
    expect(errorFor(bio, "abcdef")).toBe("Enter at most 5 characters")
    expect(errorFor(bio, "abcd")).toBeUndefined()
    expect(errorFor(bio, 12)).toBe("Enter text")
  })

  it("counts text length in code points", () => {
    const bio = field("short_text", {
      validation: { min_length: 3, max_length: 3 },
    })
    expect(errorFor(bio, "\u{1F600}\u{1F600}\u{1F600}")).toBeUndefined()
    expect(errorFor(bio, "\u{1F600}\u{1F600}")).toBe(
      "Enter at least 3 characters"
    )
  })

  it("validates emails and urls", () => {
    expect(errorFor(field("email"), "a@b.co")).toBeUndefined()
    expect(errorFor(field("url"), "https://example.com")).toBeUndefined()
    expect(errorFor(field("url"), "ftp://example.com")).toBe(
      "Enter a valid URL starting with http:// or https://"
    )
  })

  it("validates numbers", () => {
    const age = field("number", {
      validation: { min: 18, max: 99, integer: true },
    })
    expect(errorFor(age, 17)).toBe("Enter 18 or more")
    expect(errorFor(age, 100)).toBe("Enter 99 or less")
    expect(errorFor(age, 20.5)).toBe("Enter a whole number")
    expect(errorFor(age, "20")).toBe("Enter a number")
    expect(errorFor(age, 20)).toBeUndefined()
  })

  it("validates dates", () => {
    const date = field("date", {
      validation: { min: "2026-01-01", max: "2026-12-31" },
    })
    expect(errorFor(date, "2025-12-31")).toBe("Enter 2026-01-01 or later")
    expect(errorFor(date, "2027-01-01")).toBe("Enter 2026-12-31 or earlier")
    expect(errorFor(date, "2026-13-01")).toBe("Enter a valid date")
    expect(errorFor(date, "2026-06-01")).toBeUndefined()
  })

  it("validates choices", () => {
    const single = field("single_choice", { options: ["A", "B"] })
    const multiple = field("multiple_choice", { options: ["A", "B"] })
    expect(errorFor(single, "C")).toBe("Choose one of the options")
    expect(errorFor(single, "A")).toBeUndefined()
    expect(errorFor(multiple, ["A", "C"])).toBe("Choose from the options")
    expect(errorFor(multiple, ["A", "A"])).toBe("Choose from the options")
    expect(errorFor(multiple, ["A", "B"])).toBeUndefined()
  })

  it("validates files against defaults and overrides", () => {
    const resume = field("file")
    const pdf = {
      path: "u/r.pdf",
      name: "r.pdf",
      size: 1024,
      type: "application/pdf",
    }
    expect(errorFor(resume, pdf)).toBeUndefined()
    expect(errorFor(resume, { ...pdf, type: "image/png" })).toBe(
      "This file type is not allowed"
    )
    expect(errorFor(resume, { ...pdf, size: 11 * 1024 * 1024 })).toBe(
      "Files must be 10 MB or smaller"
    )
    const image = field("file", {
      validation: { accept: ["image/png"], max_size_mb: 1 },
    })
    expect(errorFor(image, { ...pdf, type: "image/png" })).toBeUndefined()
    expect(
      errorFor(image, { ...pdf, type: "image/png", size: 2 * 1024 * 1024 })
    ).toBe("Files must be 1 MB or smaller")
    expect(errorFor(resume, "r.pdf")).toBe("Upload a file")
    const oversized = field("file", { validation: { max_size_mb: 50 } })
    expect(errorFor(oversized, { ...pdf, size: 11 * 1024 * 1024 })).toBe(
      "Files must be 10 MB or smaller"
    )
  })

  it("skips sections", () => {
    const heading = section()
    expect(
      validateAnswers(
        { fields: [heading] },
        { [heading.id]: 42 },
        { mode: "submit" }
      )
    ).toEqual({})
  })

  it("skips the given fields", () => {
    const phone = field("short_text", { required: true })
    const size = field("single_choice", { options: ["S", "M"] })
    const bio = field("long_text", { required: true })
    const schema = { fields: [phone, size, bio] }
    expect(
      validateAnswers(
        schema,
        { [size.id]: "XL" },
        { mode: "submit", skip: new Set([phone.id, size.id]) }
      )
    ).toEqual({ [bio.id]: "Required" })
  })
})
