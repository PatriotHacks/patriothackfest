import { describe, expect, it } from "vitest"

import {
  LOCKED_ANSWER_ERROR,
  lockedAnswerErrors,
  lockedFieldIds,
} from "./sections"
import { field, section } from "./test-utils"

const basics = section({ editable_after_submit: false })
const name = field("short_text")
const resume = field("file")
const extras = section({ editable_after_submit: true })
const bio = field("long_text")
const tags = field("multiple_choice", { options: ["A", "B"] })
const schema = { fields: [basics, name, resume, extras, bio, tags] }

describe("lockedFieldIds", () => {
  it("assigns questions to the nearest preceding section", () => {
    expect([...lockedFieldIds(schema)]).toEqual([name.id, resume.id])
  })

  it("locks questions before the first section", () => {
    const loose = field("short_text")
    expect([...lockedFieldIds({ fields: [loose, extras, bio] })]).toEqual([
      loose.id,
    ])
  })
})

describe("lockedAnswerErrors", () => {
  const file = { path: "a/b/c/d.pdf", name: "d.pdf", size: 1, type: "x" }
  const before = { [name.id]: "Ada", [resume.id]: file, [tags.id]: ["A"] }

  it("allows changes in editable sections", () => {
    expect(
      lockedAnswerErrors(schema, before, {
        [name.id]: "Ada",
        [resume.id]: { ...file },
        [bio.id]: "Hi",
      })
    ).toEqual({})
  })

  it("rejects changing or clearing answers in locked sections", () => {
    expect(
      lockedAnswerErrors(schema, before, {
        [name.id]: "Grace",
        [tags.id]: ["A"],
      })
    ).toEqual({
      [name.id]: LOCKED_ANSWER_ERROR,
      [resume.id]: LOCKED_ANSWER_ERROR,
    })
  })

  it("rejects adding a file answer in a locked section", () => {
    expect(
      lockedAnswerErrors(
        schema,
        { [name.id]: "Ada" },
        { [name.id]: "Ada", [resume.id]: file }
      )
    ).toEqual({ [resume.id]: LOCKED_ANSWER_ERROR })
  })

  it("compares nested values structurally", () => {
    expect(
      lockedAnswerErrors(schema, before, {
        ...before,
        [resume.id]: { ...file, size: 2 },
      })
    ).toEqual({ [resume.id]: LOCKED_ANSWER_ERROR })
    expect(lockedAnswerErrors(schema, { [name.id]: null }, {})).toEqual({
      [name.id]: LOCKED_ANSWER_ERROR,
    })
  })
})
