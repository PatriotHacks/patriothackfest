import { describe, expect, it } from "vitest"

import {
  buildApplicationsCsv,
  escapeCsvCell,
  type ApplicationCsvRow,
} from "./csv"
import type { Field } from "./schema"
import { field, section } from "./test-utils"

const URL = "https://admin.example.com/applications/app-1"

function row(overrides: Partial<ApplicationCsvRow> = {}): ApplicationCsvRow {
  return {
    id: "app-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    role: "participant",
    status: "submitted",
    submittedAt: null,
    decision: "pending",
    decidedAt: null,
    decisionsReleased: false,
    declinedAt: null,
    withdrawnAt: null,
    answers: {},
    applicationUrl: URL,
    ...overrides,
  }
}

function parse(csv: string) {
  expect(csv.endsWith("\r\n")).toBe(true)
  return csv.slice(0, -2).split("\r\n")
}

function answerCell(f: Field, value: unknown) {
  const [, line] = parse(
    buildApplicationsCsv({ fields: [f] }, [row({ answers: { [f.id]: value } })])
  )
  return line!.split(",").slice(11).join(",")
}

describe("escapeCsvCell", () => {
  it("leaves plain values alone", () => {
    expect(escapeCsvCell("hello world")).toBe("hello world")
    expect(escapeCsvCell("")).toBe("")
  })

  it("quotes commas, quotes, and newlines", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"')
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"')
    expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"')
  })

  it("neutralizes formula prefixes", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)")
    expect(escapeCsvCell("+1")).toBe("'+1")
    expect(escapeCsvCell("-1")).toBe("'-1")
    expect(escapeCsvCell("@cmd")).toBe("'@cmd")
    expect(escapeCsvCell("\tx")).toBe("'\tx")
    expect(escapeCsvCell("\rx")).toBe('"\'\rx"')
    expect(escapeCsvCell('=HYPERLINK("x","y")')).toBe(
      `"'=HYPERLINK(""x"",""y"")"`
    )
    expect(escapeCsvCell("a=b")).toBe("a=b")
  })
})

describe("buildApplicationsCsv", () => {
  it("writes fixed columns then one column per field", () => {
    const name = field("short_text", { label: "Team name" })
    const csv = buildApplicationsCsv({ fields: [name] }, [
      row({
        submittedAt: "2026-07-01T16:00:00Z",
        answers: { [name.id]: "Analytical Engines" },
      }),
    ])
    expect(parse(csv)).toEqual([
      "Application ID,Full name,Email,Role,Status,Submitted at,Decision,Decided at,Decisions released,Declined at,Withdrawn at,Team name",
      'app-1,Ada Lovelace,ada@example.com,participant,submitted,"Jul 1, 2026, 12:00 PM EDT",pending,,no,,,Analytical Engines',
    ])
  })

  it("outputs only the header for no rows", () => {
    expect(parse(buildApplicationsCsv({ fields: [] }, []))).toHaveLength(1)
  })

  it("formats timestamps in New York time and release flag", () => {
    const [, line] = parse(
      buildApplicationsCsv({ fields: [] }, [
        row({
          fullName: null,
          submittedAt: "2026-07-01T16:00:00Z",
          status: "withdrawn",
          decision: "accepted",
          decidedAt: "2026-12-01T17:00:00Z",
          decisionsReleased: true,
          declinedAt: "2026-12-02T17:30:00Z",
          withdrawnAt: "2026-12-03T05:00:00Z",
        }),
      ])
    )
    expect(line).toBe(
      'app-1,,ada@example.com,participant,withdrawn,"Jul 1, 2026, 12:00 PM EDT",accepted,"Dec 1, 2026, 12:00 PM EST",yes,"Dec 2, 2026, 12:30 PM EST","Dec 3, 2026, 12:00 AM EST"'
    )
  })

  it("de-duplicates repeated labels, including fixed headers", () => {
    const fields = [
      field("short_text", { label: "Notes" }),
      field("short_text", { label: "Notes" }),
      field("short_text", { label: "Notes (2)" }),
      field("email", { label: "Email" }),
    ]
    const [header] = parse(buildApplicationsCsv({ fields }, []))
    expect(header!.split(",").slice(10)).toEqual([
      "Withdrawn at",
      "Notes",
      "Notes (2)",
      "Notes (2) (2)",
      "Email (2)",
    ])
  })

  it("formats each answer type", () => {
    expect(answerCell(field("long_text"), "hi")).toBe("hi")
    expect(answerCell(field("number"), 42)).toBe("42")
    expect(answerCell(field("number"), -3)).toBe("'-3")
    expect(answerCell(field("date"), "2026-07-01")).toBe("2026-07-01")
    expect(answerCell(field("url"), "https://x.dev")).toBe("https://x.dev")
    expect(answerCell(field("single_choice"), "A")).toBe("A")
    expect(answerCell(field("multiple_choice"), ["A", "B"])).toBe("A; B")
    expect(answerCell(field("checkbox"), true)).toBe("yes")
    expect(answerCell(field("checkbox"), false)).toBe("no")
    expect(
      answerCell(field("file"), {
        path: "u/a/f/x.pdf",
        name: "resume.pdf",
        size: 10,
        type: "application/pdf",
      })
    ).toBe(`resume.pdf (${URL})`)
  })

  it("leaves unanswered fields empty", () => {
    expect(answerCell(field("short_text"), undefined)).toBe("")
    expect(answerCell(field("checkbox"), undefined)).toBe("")
    expect(answerCell(field("file"), null)).toBe("")
  })

  it("drops answers to keys not in the schema", () => {
    const name = field("short_text")
    const [header, line] = parse(
      buildApplicationsCsv({ fields: [name] }, [
        row({ answers: { [name.id]: "x", stale: "gone" } }),
      ])
    )
    expect(header!.split(",")).toHaveLength(12)
    expect(line!.split(",")).toHaveLength(12)
    expect(line).not.toContain("gone")
  })

  it("blanks answers to hidden conditional fields", () => {
    const size = field("single_choice", { options: ["S", "XL"] })
    const why = field("short_text", {
      condition: { field_id: size.id, operator: "equals", value: "XL" },
    })
    const schema = { fields: [size, why] }
    const [, hidden, shown] = parse(
      buildApplicationsCsv(schema, [
        row({ answers: { [size.id]: "S", [why.id]: "stale" } }),
        row({ answers: { [size.id]: "XL", [why.id]: "tall" } }),
      ])
    )
    expect(hidden!.endsWith(",S,")).toBe(true)
    expect(shown!.endsWith(",XL,tall")).toBe(true)
  })

  it("quotes and neutralizes user-supplied values", () => {
    const text = field("long_text", { label: 'Why, "really"?' })
    const csv = buildApplicationsCsv({ fields: [text] }, [
      row({
        fullName: "=cmd|' /C calc'!A0",
        answers: { [text.id]: "line one\nline, two" },
      }),
    ])
    const [header] = parse(csv)
    expect(header!.endsWith(',"Why, ""really""?"')).toBe(true)
    expect(csv).toContain(",'=cmd|' /C calc'!A0,")
    expect(csv).toContain('"line one\nline, two"\r\n')
  })

  it("writes one row per application in order", () => {
    const lines = parse(
      buildApplicationsCsv({ fields: [] }, [
        row({ id: "a" }),
        row({ id: "b" }),
        row({ id: "c" }),
      ])
    )
    expect(lines.slice(1).map((l) => l.split(",")[0])).toEqual(["a", "b", "c"])
  })

  it("omits sections from the columns", () => {
    const heading = section({ label: "About" })
    const name = field("short_text", { label: "Name" })
    const [header, line] = parse(
      buildApplicationsCsv({ fields: [heading, name] }, [
        row({ answers: { [heading.id]: "x", [name.id]: "Ada" } }),
      ])
    )
    expect(header!.split(",").slice(11)).toEqual(["Name"])
    expect(line!.split(",").slice(11)).toEqual(["Ada"])
  })
})
