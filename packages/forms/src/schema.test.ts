import { describe, expect, it } from "vitest"

import { fieldSchema, publishedSchemaSchema, textLimit } from "./schema"
import { field } from "./test-utils"

const id = "3f1c2b8e-5d4a-4e7b-9c1d-2a3b4c5d6e7f"

describe("fieldSchema", () => {
  it("parses a choice field with options", () => {
    const field = fieldSchema.parse({
      id,
      type: "single_choice",
      label: "Shirt size",
      help_text: null,
      required: true,
      options: ["S", "M"],
      validation: null,
      condition: null,
    })
    expect(field.type).toBe("single_choice")
  })

  it("rejects options on non-choice fields", () => {
    const result = fieldSchema.safeParse({
      id,
      type: "short_text",
      label: "Name",
      help_text: null,
      required: false,
      options: ["x"],
      validation: null,
      condition: null,
    })
    expect(result.success).toBe(false)
  })

  it("rejects unknown condition operators", () => {
    const result = fieldSchema.safeParse({
      id,
      type: "long_text",
      label: "Why",
      help_text: null,
      required: false,
      options: null,
      validation: null,
      condition: { field_id: id, operator: "gt", value: "x" },
    })
    expect(result.success).toBe(false)
  })

  it("defaults text validation to characters", () => {
    const field = fieldSchema.parse({
      id,
      type: "long_text",
      label: "Why",
      help_text: null,
      required: false,
      options: null,
      validation: { max_length: 500 },
      condition: null,
    })
    expect(field.validation).toEqual({
      max_length: 500,
      length_unit: "characters",
    })
  })

  it("caps word limits", () => {
    const text = (validation: object) =>
      fieldSchema.safeParse({
        id,
        type: "short_text",
        label: "Why",
        help_text: null,
        required: false,
        options: null,
        validation,
        condition: null,
      }).success
    expect(text({ max_length: 1500, length_unit: "words" })).toBe(true)
    expect(text({ max_length: 1501, length_unit: "words" })).toBe(false)
    expect(text({ min_length: 1501, length_unit: "words" })).toBe(false)
    expect(text({ max_length: 5000, length_unit: "characters" })).toBe(true)
    expect(text({ max_length: 10, length_unit: "lines" })).toBe(false)
  })

  it("parses file validation", () => {
    const field = fieldSchema.parse({
      id,
      type: "file",
      label: "Resume",
      help_text: null,
      required: true,
      options: null,
      validation: { accept: ["application/pdf"], max_size_mb: 5 },
      condition: null,
    })
    expect(field.validation).toEqual({
      accept: ["application/pdf"],
      max_size_mb: 5,
    })
  })

  it("rejects file validation the storage bucket would refuse", () => {
    const file = (validation: unknown) =>
      fieldSchema.safeParse({
        id,
        type: "file",
        label: "Resume",
        help_text: null,
        required: true,
        options: null,
        validation,
        condition: null,
      }).success
    expect(file({ max_size_mb: 10 })).toBe(true)
    expect(file({ max_size_mb: 0.5 })).toBe(true)
    expect(file({ max_size_mb: 10.5 })).toBe(false)
    expect(file({ max_size_mb: 0 })).toBe(false)
    expect(file({ max_size_mb: Number.NaN })).toBe(false)
    expect(file({ accept: ["image/png"] })).toBe(false)
    expect(file({ accept: ["application/pdf", "image/png"] })).toBe(false)
  })
})

describe("section items", () => {
  const section = {
    id,
    type: "section",
    label: "About you",
    help_text: "Tell us about yourself",
    required: false,
    options: null,
    validation: null,
    condition: null,
    editable_after_submit: true,
  }

  it("parses a section", () => {
    expect(fieldSchema.parse(section)).toEqual(section)
  })

  it("rejects required sections, conditions, and a missing editable flag", () => {
    expect(fieldSchema.safeParse({ ...section, required: true }).success).toBe(
      false
    )
    expect(
      fieldSchema.safeParse({
        ...section,
        condition: { field_id: id, operator: "equals", value: true },
      }).success
    ).toBe(false)
    const { editable_after_submit: _, ...withoutFlag } = section
    expect(fieldSchema.safeParse(withoutFlag).success).toBe(false)
  })
})

describe("publishedSchemaSchema", () => {
  it("parses a snapshot", () => {
    const schema = publishedSchemaSchema.parse({
      title: "Participant",
      description: null,
      fields: [],
    })
    expect(schema.fields).toEqual([])
  })
})

describe("textLimit", () => {
  it("returns the maximum and unit for limited text fields only", () => {
    expect(
      textLimit(
        field("long_text", {
          validation: { max_length: 200, length_unit: "words" },
        })
      )
    ).toEqual({ max: 200, unit: "words" })
    expect(
      textLimit(
        field("short_text", {
          validation: { min_length: 2, length_unit: "characters" },
        })
      )
    ).toBeNull()
    expect(textLimit(field("short_text"))).toBeNull()
    expect(textLimit(field("number", { validation: { max: 5 } }))).toBeNull()
  })
})
