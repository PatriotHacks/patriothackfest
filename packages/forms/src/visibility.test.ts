import { describe, expect, it } from "vitest"

import { field, section } from "./test-utils"
import { isFieldVisible, pruneHiddenAnswers } from "./visibility"

describe("isFieldVisible", () => {
  const size = field("single_choice", { options: ["S", "XL"] })
  const diets = field("multiple_choice", { options: ["Vegan", "Halal"] })
  const agree = field("checkbox")
  const why = field("long_text", {
    condition: { field_id: size.id, operator: "equals", value: "XL" },
  })
  const vegan = field("short_text", {
    condition: { field_id: diets.id, operator: "includes", value: "Vegan" },
  })
  const unchecked = field("short_text", {
    condition: { field_id: agree.id, operator: "equals", value: false },
  })
  const nested = field("short_text", {
    condition: { field_id: why.id, operator: "equals", value: "x" },
  })
  const schema = { fields: [size, diets, agree, why, vegan, unchecked, nested] }

  it("shows unconditional fields", () => {
    expect(isFieldVisible(size, {}, schema)).toBe(true)
  })

  it("evaluates equals on single choice", () => {
    expect(isFieldVisible(why, { [size.id]: "XL" }, schema)).toBe(true)
    expect(isFieldVisible(why, { [size.id]: "S" }, schema)).toBe(false)
    expect(isFieldVisible(why, {}, schema)).toBe(false)
  })

  it("evaluates includes on multiple choice", () => {
    expect(
      isFieldVisible(vegan, { [diets.id]: ["Halal", "Vegan"] }, schema)
    ).toBe(true)
    expect(isFieldVisible(vegan, { [diets.id]: ["Halal"] }, schema)).toBe(false)
  })

  it("treats an unanswered checkbox as false", () => {
    expect(isFieldVisible(unchecked, {}, schema)).toBe(true)
    expect(isFieldVisible(unchecked, { [agree.id]: true }, schema)).toBe(false)
  })

  it("hides fields whose source is hidden", () => {
    const answers = { [size.id]: "S", [why.id]: "x" }
    expect(isFieldVisible(nested, answers, schema)).toBe(false)
  })

  it("hides fields whose source is missing", () => {
    const orphan = field("short_text", {
      condition: {
        field_id: "00000000-0000-4000-8000-999999999999",
        operator: "equals",
        value: "A",
      },
    })
    expect(isFieldVisible(orphan, {}, { fields: [orphan] })).toBe(false)
  })

  it("terminates on cyclic conditions", () => {
    const a = field("single_choice")
    const b = field("single_choice", {
      condition: { field_id: a.id, operator: "equals", value: "A" },
    })
    a.condition = { field_id: b.id, operator: "equals", value: "A" }
    expect(
      isFieldVisible(a, { [a.id]: "A", [b.id]: "A" }, { fields: [a, b] })
    ).toBe(false)
  })
})

describe("pruneHiddenAnswers", () => {
  it("drops hidden and unknown answers", () => {
    const size = field("single_choice", { options: ["S", "XL"] })
    const why = field("long_text", {
      condition: { field_id: size.id, operator: "equals", value: "XL" },
    })
    const schema = { fields: [size, why] }
    expect(
      pruneHiddenAnswers(schema, { [size.id]: "S", [why.id]: "big", other: 1 })
    ).toEqual({ [size.id]: "S" })
    expect(
      pruneHiddenAnswers(schema, { [size.id]: "XL", [why.id]: "big" })
    ).toEqual({ [size.id]: "XL", [why.id]: "big" })
  })

  it("drops answers keyed by sections", () => {
    const heading = section()
    const name = field("short_text")
    expect(
      pruneHiddenAnswers(
        { fields: [heading, name] },
        { [heading.id]: "x", [name.id]: "Ada" }
      )
    ).toEqual({ [name.id]: "Ada" })
  })
})
