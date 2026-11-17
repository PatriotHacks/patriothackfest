import { describe, expect, it } from "vitest"

import {
  competitionDates,
  competitionSettingsInput,
  competitionSettingsValues,
  competitionTrackInput,
  adminProjectQuestionsSchema,
  judgingEndInputValue,
  projectQuestionInput,
  projectQuestionRpcArgs,
  type CompetitionSettingsInput,
} from "./judging"

const defaults: CompetitionSettingsInput = {
  eventId: "e0000000-0000-4000-8000-000000000001",
  enabled: true,
  open: "2026-11-15T00:00",
  close: "",
  judgingEnd: "2026-11-20T23:59",
  generalReviews: 3,
}

describe("competition settings", () => {
  it("uses midnight EST opening and includes the entire final judging minute", () => {
    expect(competitionSettingsInput.parse(defaults)).toEqual(defaults)
    expect(competitionDates(defaults)).toEqual({
      open: "2026-11-15T05:00:00.000Z",
      close: null,
      judgingClose: "2026-11-21T05:00:00.000Z",
    })
  })

  it("round-trips the final included minute without adding time on every save", () => {
    const dates = competitionDates(defaults)
    expect(judgingEndInputValue(dates.judgingClose)).toBe(defaults.judgingEnd)
    expect(
      competitionDates({
        ...defaults,
        judgingEnd: judgingEndInputValue(dates.judgingClose),
      })
    ).toEqual(dates)
    expect(judgingEndInputValue(null)).toBe("")
  })

  it("allows disabled events to remain unconfigured", () => {
    expect(
      competitionDates({
        ...defaults,
        enabled: false,
        open: "",
        judgingEnd: "",
      })
    ).toEqual({ open: null, close: null, judgingClose: null })
  })

  it("requires opening and judging end when enabled", () => {
    expect(() => competitionDates({ ...defaults, open: "" })).toThrow(
      "before enabling"
    )
    expect(() => competitionDates({ ...defaults, judgingEnd: "" })).toThrow(
      "before enabling"
    )
  })

  it("rejects reversed or equal submission dates and judging end before closing", () => {
    expect(() =>
      competitionDates({ ...defaults, close: defaults.open })
    ).toThrow("closing must be after opening")
    expect(() =>
      competitionDates({
        ...defaults,
        open: "",
        close: defaults.open,
        enabled: false,
      })
    ).toThrow("closing must be after opening")
    expect(() =>
      competitionDates({ ...defaults, close: "2026-11-21T00:00" })
    ).toThrow("Judging end must be after")
    expect(() =>
      competitionDates({ ...defaults, judgingEnd: "2026-11-14T23:59" })
    ).toThrow("Judging end must be after")
  })

  it("permits extensions regardless of whether the old deadline is in the past", () => {
    expect(
      competitionDates({ ...defaults, judgingEnd: "2026-11-22T23:59" })
        .judgingClose
    ).toBe("2026-11-23T05:00:00.000Z")
    expect(
      competitionDates({
        ...defaults,
        open: "2020-01-01T00:00",
        judgingEnd: "2020-01-02T23:59",
      }).judgingClose
    ).toBe("2020-01-03T05:00:00.000Z")
  })

  it.each([
    "not-a-date",
    "2026-02-30T12:00",
    "2026-11-15T25:00",
    "2027-03-14T02:30",
  ])("rejects invalid or nonexistent local time %s", (open) => {
    expect(
      competitionSettingsInput.safeParse({ ...defaults, open }).success
    ).toBe(false)
  })

  it.each([0, 21, 1.5, NaN])(
    "rejects invalid review target %s",
    (generalReviews) => {
      expect(
        competitionSettingsInput.safeParse({ ...defaults, generalReviews })
          .success
      ).toBe(false)
    }
  )

  it("requires a valid event ID and a real boolean", () => {
    expect(
      competitionSettingsInput.safeParse({ ...defaults, eventId: "bad" })
        .success
    ).toBe(false)
    expect(
      competitionSettingsInput.safeParse({ ...defaults, enabled: "true" })
        .success
    ).toBe(false)
  })
})

describe("competition tracks", () => {
  const track = {
    eventId: defaults.eventId,
    name: "  Sponsor challenge  ",
    sponsor: "",
    description: "",
    reviews: 1,
    active: true,
  }

  it("trims names and allows optional sponsor/description", () => {
    expect(competitionTrackInput.parse(track).name).toBe("Sponsor challenge")
  })

  it("rejects blank/oversized names, excessive review targets, and oversized descriptions", () => {
    for (const change of [
      { name: " " },
      { name: "x".repeat(121) },
      { reviews: 0 },
      { reviews: 21 },
      { description: "x".repeat(2001) },
    ]) {
      expect(
        competitionTrackInput.safeParse({ ...track, ...change }).success
      ).toBe(false)
    }
  })
})

describe("split settings forms", () => {
  it("turns stored settings into form values that round-trip unchanged", () => {
    const values = competitionSettingsValues(defaults.eventId, {
      event_id: defaults.eventId,
      enabled: true,
      project_submissions_open_at: "2026-11-15T05:00:00Z",
      project_submissions_close_at: null,
      judging_started_at: null,
      judging_close_at: "2026-11-21T05:00:00Z",
      general_reviews_per_project: 3,
      judges_see_answers: false,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    })
    expect(values).toEqual(defaults)
    expect(competitionDates(values).judgingClose).toBe(
      "2026-11-21T05:00:00.000Z"
    )
  })
  it("uses disabled blank defaults before settings exist", () => {
    expect(competitionSettingsValues(defaults.eventId, null)).toEqual({
      eventId: defaults.eventId,
      enabled: false,
      open: "",
      close: "",
      judgingEnd: "",
      generalReviews: 3,
    })
  })
})

describe("project question input", () => {
  const question = {
    eventId: defaults.eventId,
    label: " Why? ",
    helpText: " ",
    required: false,
    type: "long_text" as const,
    maxLength: 5000,
    options: [],
  }
  const optionId = "a0000000-0000-4000-8000-000000000001"
  it("trims text and bounds length limits", () => {
    expect(projectQuestionInput.parse(question)).toMatchObject({
      label: "Why?",
      helpText: "",
    })
    expect(
      projectQuestionInput.safeParse({ ...question, label: " " }).success
    ).toBe(false)
    expect(
      projectQuestionInput.safeParse({ ...question, label: "x".repeat(301) })
        .success
    ).toBe(false)
    expect(
      projectQuestionInput.safeParse({ ...question, maxLength: 0 }).success
    ).toBe(false)
    expect(
      projectQuestionInput.safeParse({ ...question, maxLength: 10_001 }).success
    ).toBe(false)
  })
  it("requires distinct, labeled options for choice types", () => {
    const choice = { ...question, type: "single_choice" as const }
    expect(
      projectQuestionInput.safeParse(choice).error?.issues[0]?.message
    ).toBe("Add at least one option")
    expect(
      projectQuestionInput.safeParse({
        ...choice,
        options: [{ id: optionId, label: " " }],
      }).success
    ).toBe(false)
    expect(
      projectQuestionInput.safeParse({
        ...choice,
        options: [
          { id: optionId, label: "Yes" },
          { id: defaults.eventId, label: " yes " },
        ],
      }).error?.issues[0]?.message
    ).toBe("Option labels must be unique")
    expect(
      projectQuestionInput.safeParse({
        ...question,
        type: "multiple_choice",
        options: [{ id: optionId, label: " Yes " }],
      }).data?.options
    ).toEqual([{ id: optionId, label: "Yes" }])
  })
  it("bounds file size limits", () => {
    expect(
      projectQuestionInput.safeParse({
        ...question,
        type: "file",
        maxSizeMb: 11,
      }).success
    ).toBe(false)
  })
  it("sends only the settings that apply to the type", () => {
    const options = [{ id: optionId, label: "Yes" }]
    expect(
      projectQuestionRpcArgs(
        projectQuestionInput.parse({ ...question, options })
      )
    ).toMatchObject({
      p_type: "long_text",
      p_max_length: 5000,
      p_options: undefined,
    })
    expect(
      projectQuestionRpcArgs(
        projectQuestionInput.parse({
          ...question,
          type: "single_choice",
          options,
        })
      )
    ).toMatchObject({
      p_max_length: undefined,
      p_options: options,
      p_validation: undefined,
    })
    expect(
      projectQuestionRpcArgs(
        projectQuestionInput.parse({ ...question, type: "file", maxSizeMb: 2 })
      )
    ).toMatchObject({
      p_max_length: undefined,
      p_validation: { max_size_mb: 2 },
    })
    expect(
      projectQuestionRpcArgs(
        projectQuestionInput.parse({ ...question, type: "url" })
      )
    ).toMatchObject({
      p_max_length: undefined,
      p_options: undefined,
      p_validation: undefined,
    })
  })
})

describe("admin project questions", () => {
  it("parses typed questions with their answered flag", () => {
    const [parsed] = adminProjectQuestionsSchema.parse([
      {
        id: optionIdFor(1),
        event_id: defaults.eventId,
        position: 1,
        label: "Deck",
        help_text: null,
        required: true,
        type: "file",
        max_length: null,
        options: null,
        validation: { max_size_mb: 5 },
        archived_at: null,
        created_at: "2026-11-15T05:00:00Z",
        updated_at: "2026-11-15T05:00:00Z",
        answered: true,
      },
    ])
    expect(parsed).toMatchObject({ type: "file", answered: true })
  })
})

function optionIdFor(n: number) {
  return `a0000000-0000-4000-8000-00000000000${n}`
}
