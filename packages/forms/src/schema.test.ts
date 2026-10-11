import { describe, expect, it } from "vitest"

import { fieldSchema, publishedSchemaSchema } from "./schema"

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
