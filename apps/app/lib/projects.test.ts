import { describe, expect, it } from "vitest"
import {
  canManageProject,
  completeProjectContentSchema,
  projectContentSchema,
  projectFailure,
  projectPhase,
  projectSaveSchema,
  type ProjectEvent,
} from "./projects"

const id = "a0000000-0000-4000-8000-000000000001"
const event: ProjectEvent = {
  event_id: id,
  name: "Event",
  slug: "fall-2026",
  enabled: true,
  eligible: true,
  project_submissions_open_at: "2026-11-15T05:00:00Z",
  project_submissions_close_at: null,
  judging_started_at: null,
}

describe("project fields", () => {
  it("accepts incomplete drafts but not incomplete submissions", () => {
    expect(projectContentSchema.safeParse({}).success).toBe(true)
    expect(completeProjectContentSchema.safeParse({}).success).toBe(false)
  })
  it("requires only short text and one reviewable link", () => {
    expect(
      completeProjectContentSchema.parse({
        name: " A ",
        summary: "B",
        description: "C",
        video_url: "https://example.com",
      }).name
    ).toBe("A")
  })
  it.each([
    "javascript:alert(1)",
    "https://",
    "ftp://example.com",
    "https://a b.test",
    "https://user:pass@example.com",
    "https:\\example.com",
  ])("rejects unsafe/invalid link %s", (demo_url) => {
    expect(projectContentSchema.safeParse({ demo_url }).success).toBe(false)
  })
  it("accepts blank optional links and ordinary local demo links", () => {
    expect(
      projectContentSchema.parse({
        demo_url: " ",
        repository_url: "http://localhost:3000",
      }).demo_url
    ).toBe("")
  })
  it("rejects excess lengths and privilege fields", () => {
    expect(
      projectContentSchema.safeParse({ name: "a".repeat(121) }).success
    ).toBe(false)
    expect(projectContentSchema.safeParse({ owner_user_id: id }).success).toBe(
      false
    )
    expect(
      projectSaveSchema.safeParse({
        projectId: id,
        content: {},
        trackIds: [],
        submit: false,
        updatedAt: "2026-11-15T05:00:00.123456+00:00",
        status: "submitted",
      }).success
    ).toBe(false)
  })
  it("preserves microsecond timestamps for database stale checks", () => {
    const updatedAt = "2026-11-15T05:00:00.123456+00:00"
    expect(
      projectSaveSchema.parse({
        projectId: id,
        content: {},
        trackIds: [],
        submit: false,
        updatedAt,
      }).updatedAt
    ).toBe(updatedAt)
  })
})

describe("project availability", () => {
  it("uses exact opening and optional/exclusive closing", () => {
    const opening = Date.parse(event.project_submissions_open_at!)
    expect(projectPhase(event, opening - 1)).toBe("scheduled")
    expect(canManageProject(event, opening - 1)).toBe(true)
    expect(projectPhase(event, opening)).toBe("open")
    expect(projectPhase(event, opening + 1e12)).toBe("open")
    expect(
      projectPhase(
        { ...event, project_submissions_close_at: "2026-11-16T05:00:00Z" },
        Date.parse("2026-11-16T05:00:00Z")
      )
    ).toBe("closed")
  })
  it("does not add eligibility or reopen after judging starts", () => {
    expect(canManageProject({ ...event, eligible: false })).toBe(false)
    expect(projectPhase({ ...event, enabled: false })).toBe("disabled")
    expect(
      projectPhase({
        ...event,
        enabled: false,
        judging_started_at: "2026-11-17T00:00:00Z",
      })
    ).toBe("judging")
  })
  it("maps database field errors safely", () => {
    expect(
      projectFailure({
        code: "PT422",
        message: "Invalid",
        details: '{"name":"Required"}',
      })
    ).toEqual({ error: "Invalid", fieldErrors: { name: "Required" } })
    expect(
      projectFailure({ code: "PT422", message: "Invalid", details: "bad json" })
    ).toEqual({ error: "Invalid" })
    expect(projectFailure({ code: "PT409", message: "Reload" })).toEqual({
      error: "Reload",
    })
  })
})
