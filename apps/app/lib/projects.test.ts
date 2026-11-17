import { describe, expect, it } from "vitest"
import {
  canManageProject,
  completeProjectContentSchema,
  memberName,
  normalizedProjectAnswers,
  projectAnswers,
  projectContentSchema,
  projectDetailSchema,
  projectFailure,
  projectPhase,
  projectSaveSchema,
  replacedFilePaths,
  STALE_PROJECT_MESSAGE,
  teamMembers,
  type ProjectDetail,
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
        eventId: id,
        content: {},
        answers: {},
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
        eventId: id,
        content: {},
        answers: {},
        trackIds: [],
        submit: false,
        updatedAt,
      }).updatedAt
    ).toBe(updatedAt)
  })
})

describe("typed project answers", () => {
  const questionId = "b0000000-0000-4000-8000-000000000001"
  const optionId = "c0000000-0000-4000-8000-000000000001"
  const file = {
    path: `${id}/${questionId}/${optionId}.pdf`,
    name: "deck.pdf",
    size: 100,
    type: "application/pdf",
  }
  const save = (answers: unknown) =>
    projectSaveSchema.safeParse({
      projectId: id,
      eventId: id,
      content: {},
      answers,
      trackIds: [],
      submit: false,
      updatedAt: "2026-11-15T05:00:00Z",
    })

  it("accepts text, choice ids, files, and cleared answers", () => {
    expect(save({ [questionId]: " text " }).data?.answers[questionId]).toBe(
      "text"
    )
    for (const value of [[optionId], file, null])
      expect(save({ [questionId]: value }).success).toBe(true)
  })

  it("rejects malformed typed answers", () => {
    for (const value of [42, ["not-an-id"], { path: "x" }, "x".repeat(10_001)])
      expect(save({ [questionId]: value }).success).toBe(false)
  })

  it("loads stored answers per question type", () => {
    const detail = projectDetailSchema.parse({
      project: {
        id,
        event_id: id,
        owner_user_id: id,
        name: "",
        summary: "",
        description: "",
        technologies: "",
        repository_url: null,
        demo_url: null,
        video_url: null,
        status: "draft",
        submitted_at: null,
        updated_at: "2026-11-15T05:00:00Z",
        answers: { [questionId]: ["removed", optionId], [id]: file },
      },
      owner: { user_id: id, full_name: "Owner" },
      collaborators: [],
      max_team_size: null,
      selected_tracks: [],
      available_tracks: [],
      questions: [
        {
          id: questionId,
          label: "Pick",
          help_text: null,
          required: true,
          type: "multiple_choice",
          max_length: null,
          length_unit: "characters" as const,
          options: [{ id: optionId, label: "Web" }],
          validation: null,
        },
        {
          id,
          label: "Deck",
          help_text: null,
          required: false,
          type: "file",
          max_length: null,
          length_unit: "characters" as const,
          options: null,
          validation: null,
        },
      ],
    })
    expect(projectAnswers(detail)).toEqual({
      [questionId]: [optionId],
      [id]: file,
    })
  })

  it("lists replaced files inside the project only", () => {
    const other = { ...file, path: `${optionId}/${questionId}/${id}.pdf` }
    expect(
      replacedFilePaths(id, { [questionId]: file, [id]: other, x: "text" }, {})
    ).toEqual([file.path])
    expect(
      replacedFilePaths(id, { [questionId]: file }, { [questionId]: file })
    ).toEqual([])
  })
  it("trims only text answers after saving", () => {
    expect(
      normalizedProjectAnswers({ a: " x ", b: [optionId], c: null })
    ).toEqual({ a: "x", b: [optionId], c: null })
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
      error: STALE_PROJECT_MESSAGE,
      stale: true,
    })
  })
})

describe("team members", () => {
  const other = "a0000000-0000-4000-8000-000000000002"
  it("lists the owner first, then collaborators", () => {
    expect(
      teamMembers({
        owner: { user_id: id, full_name: "Owner" },
        collaborators: [{ user_id: other, full_name: null }],
      } as ProjectDetail)
    ).toEqual([
      { user_id: id, full_name: "Owner", owner: true },
      { user_id: other, full_name: null, owner: false },
    ])
  })
  it("labels blank names", () => {
    expect(memberName(null)).toBe("Unnamed participant")
    expect(memberName("  ")).toBe("Unnamed participant")
    expect(memberName(" Ada ")).toBe("Ada")
  })
  it("rejects a non-positive team size limit", () => {
    expect(projectDetailSchema.shape.max_team_size.safeParse(0).success).toBe(
      false
    )
  })
})
