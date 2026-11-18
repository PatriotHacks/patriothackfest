import { describe, expect, it } from "vitest"
import {
  eventProjectsSchema,
  parseProjectsPage,
  parseProjectStatus,
  projectDetailSchema,
  projectHref,
  projectPersonLabel,
  projectsHref,
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
  it("keeps event, status, and page in detail/back links with query-safe encoding", () => {
    expect(
      projectHref("fall-2026", "project-id", { status: null, page: 2 })
    ).toBe("/project-submissions/project-id?event=fall-2026&projectsPage=2")
    expect(
      projectHref("fall-2026", "project-id", { status: "draft", page: 1 })
    ).toBe(
      "/project-submissions/project-id?event=fall-2026&status=draft&projectsPage=1"
    )
    expect(
      projectsHref("event&other=value", { status: "submitted", page: 3 })
    ).toBe(
      "/project-submissions?event=event%26other%3Dvalue&status=submitted&projectsPage=3"
    )
  })
})

describe("project status parsing", () => {
  it("accepts known statuses", () => {
    expect(parseProjectStatus("draft")).toBe("draft")
    expect(parseProjectStatus("submitted")).toBe("submitted")
    expect(parseProjectStatus("withdrawn")).toBe("withdrawn")
  })
  it.each([undefined, "", "all", "Draft", ["draft"]])(
    "treats %s as all statuses",
    (value) => {
      expect(parseProjectStatus(value)).toBeNull()
    }
  )
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
    const empty = {
      projects: [],
      has_more: false,
      required_count: 0,
      counts: { draft: 0, submitted: 0, withdrawn: 0 },
    }
    expect(eventProjectsSchema.parse(empty)).toEqual(empty)
    expect(
      eventProjectsSchema.safeParse({ ...empty, projects: null }).success
    ).toBe(false)
    expect(
      eventProjectsSchema.safeParse({ ...empty, required_count: -1 }).success
    ).toBe(false)
    expect(
      projectDetailSchema.safeParse({ project: { status: "draft" } }).success
    ).toBe(false)
  })
  it("accepts drafts without a submission time", () => {
    const id = "a0000000-0000-4000-8000-000000000001"
    const row = {
      id,
      name: "Demo",
      status: "draft",
      submitted_at: null,
      updated_at: "2026-11-15T05:00:00Z",
      owner: { id, full_name: null },
      answered_count: 1,
    }
    expect(eventProjectsSchema.shape.projects.safeParse([row]).success).toBe(
      true
    )
    expect(
      eventProjectsSchema.shape.projects.safeParse([
        { ...row, status: "archived" },
      ]).success
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
    expect(projectDetailSchema.shape.answers.safeParse([answer]).success).toBe(
      true
    )
    expect(
      projectDetailSchema.shape.answers.safeParse([{ ...answer, answer: 42 }])
        .success
    ).toBe(false)
  })
})
