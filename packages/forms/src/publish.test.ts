import { describe, expect, it } from "vitest"

import { validateForPublish } from "./publish"
import { field } from "./test-utils"

const form = {
  title: "Participant",
  submissions_close_at: "2026-11-01T04:00:00Z",
  edits_lock_at: "2026-11-02T04:00:00Z",
}

function messages(...args: Parameters<typeof validateForPublish>) {
  return validateForPublish(...args).map((issue) => issue.message)
}

describe("validateForPublish", () => {
  it("accepts a valid form", () => {
    const size = field("single_choice", { options: ["S", "XL"] })
    const why = field("long_text", {
      condition: { field_id: size.id, operator: "equals", value: "XL" },
    })
    const diets = field("multiple_choice", { options: ["Vegan"] })
    const vegan = field("short_text", {
      condition: { field_id: diets.id, operator: "includes", value: "Vegan" },
    })
    const agree = field("checkbox")
    const thanks = field("short_text", {
      condition: { field_id: agree.id, operator: "equals", value: true },
    })
    expect(
      validateForPublish(form, [size, why, diets, vegan, agree, thanks])
    ).toEqual([])
  })

  it("requires deadlines and at least one question", () => {
    expect(
      messages({ ...form, submissions_close_at: null, edits_lock_at: null }, [])
    ).toEqual([
      "Set both deadlines before publishing",
      "Add at least one question",
    ])
  })

  it("requires edits lock at or after submissions close", () => {
    expect(
      messages({ ...form, edits_lock_at: "2026-10-31T04:00:00Z" }, [
        field("short_text"),
      ])
    ).toEqual(["Edits lock must be at or after submissions close"])
  })

  it("requires a title and labels", () => {
    expect(
      messages({ ...form, title: " " }, [field("email", { label: "" })])
    ).toEqual(["Add a form title", "Question 1 needs a label"])
  })

  it("requires unique non-empty options", () => {
    const empty = field("single_choice", { options: [] })
    const duplicate = field("multiple_choice", { options: ["A", "A"] })
    const blank = field("single_choice", { options: ["A", " "] })
    const issues = validateForPublish(form, [empty, duplicate, blank])
    expect(issues).toEqual([
      { field_id: empty.id, message: "Question 1 needs at least one option" },
      {
        field_id: duplicate.id,
        message: "Question 2 has blank or duplicate options",
      },
      {
        field_id: blank.id,
        message: "Question 3 has blank or duplicate options",
      },
    ])
  })

  it("requires conditions to reference an earlier choice or checkbox question", () => {
    const text = field("short_text")
    const later = field("single_choice")
    const dependsOnText = field("long_text", {
      condition: { field_id: text.id, operator: "equals", value: "A" },
    })
    const dependsOnLater = field("long_text", {
      condition: { field_id: later.id, operator: "equals", value: "A" },
    })
    expect(
      messages(form, [text, dependsOnText, dependsOnLater, later])
    ).toEqual([
      "Question 2 must depend on an earlier choice or checkbox question",
      "Question 3 must depend on an earlier choice or checkbox question",
    ])
  })

  it("requires condition operators and values to match the source", () => {
    const single = field("single_choice", { options: ["A"] })
    const multiple = field("multiple_choice", { options: ["A"] })
    const agree = field("checkbox")
    const fields = [
      single,
      multiple,
      agree,
      field("short_text", {
        condition: { field_id: single.id, operator: "equals", value: "Z" },
      }),
      field("short_text", {
        condition: { field_id: single.id, operator: "includes", value: "A" },
      }),
      field("short_text", {
        condition: { field_id: multiple.id, operator: "equals", value: "A" },
      }),
      field("short_text", {
        condition: { field_id: agree.id, operator: "equals", value: "A" },
      }),
    ]
    expect(messages(form, fields)).toEqual([
      "Question 4 has an invalid condition",
      "Question 5 has an invalid condition",
      "Question 6 has an invalid condition",
      "Question 7 has an invalid condition",
    ])
  })
})
