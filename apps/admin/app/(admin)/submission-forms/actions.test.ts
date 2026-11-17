import { beforeEach, describe, expect, it, vi } from "vitest"

const { rpc, from, createSignedUrl, stored, requireAdmin, revalidatePath } =
  vi.hoisted(() => ({
    rpc: vi.fn(),
    createSignedUrl: vi.fn(),
    from: vi.fn(),
    stored: { data: null as unknown, error: null as unknown },
    requireAdmin: vi.fn(),
    revalidatePath: vi.fn(),
  }))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath }))

import {
  archiveProjectQuestion,
  projectFileUrl,
  reorderProjectQuestions,
  saveCompetitionTrack,
  saveProjectQuestion,
  saveSubmissionSettings,
  setJudgesSeeAnswers,
} from "./actions"

const eventId = "e0000000-0000-4000-8000-000000000001"
const questionId = "d0000000-0000-4000-8000-000000000001"
const otherQuestionId = "d0000000-0000-4000-8000-000000000002"
const submission = {
  eventId,
  enabled: true,
  open: "2026-11-15T00:00",
  close: "",
}
const track = {
  eventId,
  name: "Track",
  sponsor: "",
  description: "",
  reviews: 1,
  active: true,
}
const question = {
  eventId,
  label: " What inspired you? ",
  helpText: " One paragraph ",
  required: true,
  type: "long_text" as const,
  maxLength: 2000,
  options: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  stored.data = {
    enabled: false,
    project_submissions_open_at: null,
    project_submissions_close_at: null,
    judging_close_at: "2026-11-21T05:00:00Z",
    general_reviews_per_project: 4,
  }
  stored.error = null
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve(stored),
  }
  from.mockReturnValue(query)
  requireAdmin.mockResolvedValue({
    supabase: { rpc, from, storage: { from: () => ({ createSignedUrl }) } },
  })
  rpc.mockResolvedValue({ error: null })
})

describe("submission form server actions", () => {
  it("requires organizer permission for every mutation", async () => {
    await saveSubmissionSettings(submission)
    await saveCompetitionTrack(track)
    await saveProjectQuestion(question)
    await archiveProjectQuestion(eventId, questionId)
    await reorderProjectQuestions(eventId, [questionId])
    await setJudgesSeeAnswers(eventId, true)
    expect(requireAdmin).toHaveBeenCalledTimes(6)
    expect(
      requireAdmin.mock.calls.every(([level]) => level === "organizer")
    ).toBe(true)
  })

  it("does not reach the database when authorization fails", async () => {
    requireAdmin.mockRejectedValue(new Error("Forbidden"))
    await expect(saveSubmissionSettings(submission)).rejects.toThrow(
      "Forbidden"
    )
    await expect(saveProjectQuestion(question)).rejects.toThrow("Forbidden")
    await expect(setJudgesSeeAnswers(eventId, true)).rejects.toThrow(
      "Forbidden"
    )
    expect(rpc).not.toHaveBeenCalled()
  })

  it("saves submission fields over the stored judging settings", async () => {
    expect(await saveSubmissionSettings(submission)).toEqual({ error: null })
    expect(rpc).toHaveBeenCalledWith("admin_save_competition_settings", {
      p_event_id: eventId,
      p_enabled: true,
      p_open_at: "2026-11-15T05:00:00.000Z",
      p_close_at: undefined,
      p_judging_close_at: "2026-11-21T05:00:00.000Z",
      p_general_reviews: 4,
    })
    expect(revalidatePath).toHaveBeenCalledWith("/submission-forms")
    expect(revalidatePath).toHaveBeenCalledWith("/judging")
  })

  it("rejects enabling before a judging end is stored", async () => {
    stored.data = null
    expect((await saveSubmissionSettings(submission)).error).toContain(
      "judging end"
    )
    expect(
      (await saveSubmissionSettings({ ...submission, close: submission.open }))
        .error
    ).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it("scopes track updates to the event and revalidates both pages", async () => {
    const trackId = "c0000000-0000-4000-8000-000000000001"
    await saveCompetitionTrack({
      ...track,
      trackId,
      name: "  Track  ",
      sponsor: " Sponsor ",
    })
    expect(rpc).toHaveBeenCalledWith("admin_save_competition_track", {
      p_event_id: eventId,
      p_track_id: trackId,
      p_name: "Track",
      p_sponsor: "Sponsor",
      p_description: "",
      p_reviews: 1,
      p_active: true,
    })
    expect(revalidatePath).toHaveBeenCalledWith("/judging")
    expect(
      (await saveCompetitionTrack({ ...track, name: " " })).error
    ).toBeTruthy()
  })

  it("trims and sends question fields", async () => {
    expect(await saveProjectQuestion({ ...question, questionId })).toEqual({
      error: null,
    })
    expect(rpc).toHaveBeenCalledWith("admin_save_project_question", {
      p_event_id: eventId,
      p_question_id: questionId,
      p_label: "What inspired you?",
      p_help_text: "One paragraph",
      p_required: true,
      p_type: "long_text",
      p_max_length: 2000,
      p_options: undefined,
      p_validation: undefined,
    })
    expect(revalidatePath).toHaveBeenCalledWith("/submission-forms")
  })

  it("rejects invalid questions without database writes", async () => {
    expect((await saveProjectQuestion({ ...question, label: " " })).error).toBe(
      "Enter a question"
    )
    expect(
      (await saveProjectQuestion({ ...question, maxLength: 10_001 })).error
    ).toBeTruthy()
    expect((await archiveProjectQuestion(eventId, "bad")).error).toBe(
      "Invalid question"
    )
    expect((await reorderProjectQuestions(eventId, ["bad"])).error).toBe(
      "Invalid question order"
    )
    expect(rpc).not.toHaveBeenCalled()
  })

  it("archives, reorders, and toggles judge visibility by event", async () => {
    await archiveProjectQuestion(eventId, questionId)
    expect(rpc).toHaveBeenCalledWith("admin_archive_project_question", {
      p_event_id: eventId,
      p_question_id: questionId,
    })
    await reorderProjectQuestions(eventId, [otherQuestionId, questionId])
    expect(rpc).toHaveBeenCalledWith("admin_reorder_project_questions", {
      p_event_id: eventId,
      p_question_ids: [otherQuestionId, questionId],
    })
    await setJudgesSeeAnswers(eventId, false)
    expect(rpc).toHaveBeenCalledWith("admin_set_judges_see_answers", {
      p_event_id: eventId,
      p_value: false,
    })
  })

  it("surfaces the answered-question type lock", async () => {
    const message =
      "This question already has answers, so its type cannot change. Archive it and add a new question instead."
    rpc.mockResolvedValue({ error: { message } })
    expect(
      await saveProjectQuestion({ ...question, questionId, type: "url" })
    ).toEqual({ error: message })
    expect(rpc).toHaveBeenCalledWith(
      "admin_save_project_question",
      expect.objectContaining({ p_type: "url" })
    )
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_max_length")
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("preserves database errors without revalidating", async () => {
    rpc.mockResolvedValue({
      error: { message: "Questions are locked because judging has started" },
    })
    expect(await saveProjectQuestion(question)).toEqual({
      error: "Questions are locked because judging has started",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe("organizer project file links", () => {
  const projectId = "f0000000-0000-4000-8000-000000000001"
  const path = `${projectId}/${questionId}/${otherQuestionId}.pdf`
  it("signs project files for organizers only", async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.test/deck" },
      error: null,
    })
    expect(await projectFileUrl(path)).toEqual({
      error: null,
      url: "https://signed.test/deck",
    })
    expect(requireAdmin).toHaveBeenCalledWith("organizer")
    expect(createSignedUrl).toHaveBeenCalledWith(path, 60)
  })
  it("rejects empty paths and reports storage denials", async () => {
    expect(await projectFileUrl("")).toEqual({ error: "File not found" })
    expect(createSignedUrl).not.toHaveBeenCalled()
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    })
    expect(await projectFileUrl(path)).toEqual({ error: "Object not found" })
  })
})
