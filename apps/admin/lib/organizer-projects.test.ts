import { describe, expect, it } from "vitest"
import {
  parseProjectsPage,
  projectPersonLabel,
  submittedProjectDetailSchema,
  submittedProjectHref,
  submittedProjectsHref,
  submittedProjectsSchema,
} from "./organizer-projects"

describe("project page parsing", () => {
  it.each([
    undefined,
    ["2"],
    "",
    "0",
    "-1",
    "1.5",
    "1e2",
    "NaN",
    "2147483648",
    "999999999999999999999",
    "2\n",
  ])("defaults malformed page %s to the first page", (value) => {
    expect(parseProjectsPage(value)).toBe(1)
  })
  it("accepts positive pages within PostgreSQL integer bounds", () => {
    expect(parseProjectsPage("2")).toBe(2)
    expect(parseProjectsPage("2147483647")).toBe(2147483647)
  })
  it("keeps event and page in detail/back links with query-safe encoding", () => {
    expect(submittedProjectHref("fall-2026", "project-id", 2)).toBe(
      "/submission-forms/projects/project-id?event=fall-2026&projectsPage=2"
    )
    expect(submittedProjectsHref("event&other=value", 3)).toBe(
      "/submission-forms?event=event%26other%3Dvalue&projectsPage=3#submitted-projects"
    )
  })
})

describe("read-only project values", () => {
  it("falls back clearly for missing or blank display names", () => {
    expect(
      projectPersonLabel({ id: "abcdefgh12345678", full_name: null })
    ).toBe("Unnamed participant (12345678)")
    expect(
      projectPersonLabel({ id: "abcdefgh12345678", full_name: "  " })
    ).toBe("Unnamed participant (12345678)")
    expect(projectPersonLabel({ id: "id", full_name: " Person " })).toBe(
      "Person"
    )
  })
  it("validates bounded list/read models rather than masking malformed data", () => {
    expect(
      submittedProjectsSchema.parse({ projects: [], has_more: false })
    ).toEqual({ projects: [], has_more: false })
    expect(
      submittedProjectsSchema.safeParse({ projects: null, has_more: false })
        .success
    ).toBe(false)
    expect(
      submittedProjectDetailSchema.safeParse({ project: { status: "draft" } })
        .success
    ).toBe(false)
  })
  it("parses typed question answers", () => {
    const answer = {
      question_id: "a0000000-0000-4000-8000-000000000001",
      label: "Deck",
      type: "file",
      options: null,
      answer: {
        path: "p/q/f.pdf",
        name: "deck.pdf",
        size: 1,
        type: "application/pdf",
      },
    }
    expect(
      submittedProjectDetailSchema.shape.answers.safeParse([answer]).success
    ).toBe(true)
    expect(
      submittedProjectDetailSchema.shape.answers.safeParse([
        { ...answer, answer: 42 },
      ]).success
    ).toBe(false)
  })
})
