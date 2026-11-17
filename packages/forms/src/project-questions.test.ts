import { describe, expect, it } from "vitest"

import { pdfUploadError } from "./files"
import {
  choiceLabels,
  editableProjectAnswer,
  normalizedProjectAnswer,
  projectAnswerSchema,
  projectFileMaxSizeMb,
  projectFilePath,
  knownOptions,
  projectQuestionSchema,
  reuseOptionIds,
} from "./project-questions"

const a = "a0000000-0000-4000-8000-000000000001"
const b = "a0000000-0000-4000-8000-000000000002"
const options = [
  { id: a, label: "Alpha" },
  { id: b, label: "Beta" },
]
const file = {
  path: "p/q/f.pdf",
  name: "deck.pdf",
  size: 10,
  type: "application/pdf",
}

describe("projectQuestionSchema", () => {
  it("parses typed questions from the database", () => {
    const parsed = projectQuestionSchema.parse({
      id: a,
      label: "Pick",
      help_text: null,
      required: true,
      type: "single_choice",
      max_length: null,
      options,
      validation: null,
    })
    expect(parsed.options).toEqual(options)
  })

  it("rejects unsupported types and oversized file limits", () => {
    const base = {
      id: a,
      label: "Q",
      help_text: null,
      required: false,
      max_length: null,
      options: null,
    }
    expect(
      projectQuestionSchema.safeParse({
        ...base,
        type: "date",
        validation: null,
      }).success
    ).toBe(false)
    expect(
      projectQuestionSchema.safeParse({
        ...base,
        type: "file",
        validation: { max_size_mb: 11 },
      }).success
    ).toBe(false)
  })
})

describe("projectAnswerSchema", () => {
  it("accepts text, choice ids, files, and null", () => {
    for (const value of ["x", [a], file, null])
      expect(projectAnswerSchema.safeParse(value).success).toBe(true)
    expect(projectAnswerSchema.safeParse(42).success).toBe(false)
  })
})

describe("editableProjectAnswer", () => {
  it("drops choice ids that are no longer options", () => {
    expect(editableProjectAnswer({ type: "single_choice", options }, a)).toBe(a)
    expect(
      editableProjectAnswer({ type: "single_choice", options }, "removed")
    ).toBe("")
    expect(
      editableProjectAnswer({ type: "multiple_choice", options }, [
        b,
        "removed",
      ])
    ).toEqual([b])
  })

  it("defaults missing answers per type", () => {
    expect(
      editableProjectAnswer({ type: "long_text", options: null }, undefined)
    ).toBe("")
    expect(
      editableProjectAnswer({ type: "multiple_choice", options }, null)
    ).toEqual([])
    expect(
      editableProjectAnswer({ type: "file", options: null }, "x")
    ).toBeNull()
    expect(
      editableProjectAnswer({ type: "file", options: null }, file)
    ).toEqual(file)
  })
})

describe("choiceLabels", () => {
  it("returns labels in option order and ignores unknown ids", () => {
    expect(choiceLabels(options, [b, "removed", a])).toEqual(["Alpha", "Beta"])
    expect(choiceLabels(options, "removed")).toEqual([])
    expect(choiceLabels(null, a)).toEqual([])
  })
})

describe("project files", () => {
  it("builds the path the storage policy expects", () => {
    expect(
      projectFilePath({ projectId: "p", questionId: "q", fileId: "f" })
    ).toBe("p/q/f.pdf")
  })

  it("caps the per-question limit at 10 MB", () => {
    expect(projectFileMaxSizeMb({ validation: null })).toBe(10)
    expect(projectFileMaxSizeMb({ validation: { max_size_mb: 2 } })).toBe(2)
    expect(
      pdfUploadError({ type: "application/pdf", size: 3 * 1024 * 1024 }, 2)
    ).toBe("Files must be 2 MB or smaller")
  })
})

describe("normalizedProjectAnswer", () => {
  it("trims text and leaves other answers alone", () => {
    expect(normalizedProjectAnswer("  x ")).toBe("x")
    expect(normalizedProjectAnswer([a])).toEqual([a])
  })
})

describe("reuseOptionIds", () => {
  const fresh = "a0000000-0000-4000-8000-000000000009"
  it("reuses the id of a removed option re-added with the same label", () => {
    expect(
      reuseOptionIds(
        [
          { id: b, label: "Beta" },
          { id: fresh, label: " alpha " },
        ],
        options
      )
    ).toEqual([
      { id: b, label: "Beta" },
      { id: a, label: " alpha " },
    ])
  })
  it("keeps new ids for new labels and never duplicates a kept id", () => {
    expect(
      reuseOptionIds(
        [
          { id: a, label: "Renamed" },
          { id: fresh, label: "Alpha" },
        ],
        options
      )
    ).toEqual([
      { id: a, label: "Renamed" },
      { id: fresh, label: "Alpha" },
    ])
  })
})

describe("knownOptions", () => {
  it("lets an archived label restore its id in a later save", () => {
    const archived = [{ id: b, label: "Beta" }]
    const known = knownOptions({
      options: [options[0]!],
      archived_options: archived,
    })
    expect(known).toEqual([options[0], archived[0]])
    expect(
      reuseOptionIds(
        [
          options[0]!,
          { id: "a0000000-0000-4000-8000-000000000009", label: "beta " },
        ],
        known
      )
    ).toEqual([options[0], { id: b, label: "beta " }])
    expect(knownOptions({ options: null, archived_options: null })).toEqual([])
  })
})
