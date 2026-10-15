import { describe, expect, it } from "vitest"

import { groupSections } from "./sections"
import { resolveStep, sectionErrors, sectionsComplete } from "./steps"
import { field, section } from "./test-utils"

const loose = field("short_text", { required: true })
const about = section()
const name = field("short_text", { required: true })
const bio = field("long_text")
const experience = section()
const level = field("single_choice", {
  required: true,
  options: ["New", "Pro"],
})
const years = field("number", {
  required: true,
  condition: { field_id: level.id, operator: "equals", value: "Pro" },
})
const empty = section()
const logistics = section()
const agree = field("checkbox", { required: true })
const schema = {
  fields: [
    loose,
    about,
    name,
    bio,
    experience,
    level,
    years,
    empty,
    logistics,
    agree,
  ],
}
const groups = groupSections(schema.fields)

describe("sectionErrors", () => {
  it("returns only the section's submit errors", () => {
    expect(sectionErrors(schema, { [bio.id]: "Hi" }, groups[1]!)).toEqual({
      [name.id]: "Required",
    })
  })

  it("ignores hidden conditional questions", () => {
    expect(sectionErrors(schema, { [level.id]: "New" }, groups[2]!)).toEqual({})
    expect(sectionErrors(schema, { [level.id]: "Pro" }, groups[2]!)).toEqual({
      [years.id]: "Required",
    })
  })

  it("reports invalid optional answers", () => {
    const short = field("short_text", { validation: { max_length: 2 } })
    const fields = [about, short]
    expect(
      sectionErrors(
        { fields },
        { [short.id]: "abc" },
        groupSections(fields)[0]!
      )
    ).toEqual({ [short.id]: "Enter at most 2 characters" })
  })
})

describe("sectionsComplete", () => {
  it("treats questions before the first section as their own group", () => {
    expect(groups[0]).toEqual({ section: null, questions: [loose] })
  })

  it("marks each group by its required answers", () => {
    expect(
      sectionsComplete(
        schema,
        { [loose.id]: "x", [level.id]: "Pro", [agree.id]: false },
        groups
      )
    ).toEqual([true, false, false, true, false])
  })

  it("treats sections without questions as complete", () => {
    expect(sectionsComplete(schema, {}, groups)[3]).toBe(true)
  })
})

describe("resolveStep", () => {
  const complete = [true, true, false, true]

  it("resumes at the first incomplete step without a param", () => {
    expect(resolveStep(null, complete)).toBe(2)
  })

  it("resumes at the last step when everything is complete", () => {
    expect(resolveStep(null, [true, true, true])).toBe(2)
  })

  it("uses the requested 1-based step", () => {
    expect(resolveStep("1", complete)).toBe(0)
    expect(resolveStep("3", complete)).toBe(2)
  })

  it("clamps steps past the first incomplete one", () => {
    expect(resolveStep("4", complete)).toBe(2)
    expect(resolveStep("99", [true, true])).toBe(1)
  })

  it("clamps steps below the first", () => {
    expect(resolveStep("0", complete)).toBe(0)
    expect(resolveStep("-2", complete)).toBe(0)
  })

  it("resumes when the param is not an integer", () => {
    expect(resolveStep("abc", complete)).toBe(2)
    expect(resolveStep("1.5", complete)).toBe(2)
    expect(resolveStep("", complete)).toBe(2)
  })
})
