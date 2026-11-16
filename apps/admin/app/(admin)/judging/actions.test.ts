import { beforeEach, describe, expect, it, vi } from "vitest"

const { rpc, from, stored, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  stored: { data: null as unknown, error: null as unknown },
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath }))

import { saveJudgingSettings, startJudging } from "./actions"

const eventId = "e0000000-0000-4000-8000-000000000001"
const judging = { eventId, judgingEnd: "2026-11-20T23:59", generalReviews: 3 }

beforeEach(() => {
  vi.clearAllMocks()
  stored.data = {
    enabled: true,
    project_submissions_open_at: "2026-11-15T05:00:00Z",
    project_submissions_close_at: null,
    judging_close_at: "2026-11-19T05:00:00Z",
    general_reviews_per_project: 2,
  }
  stored.error = null
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve(stored),
  }
  from.mockReturnValue(query)
  requireAdmin.mockResolvedValue({ supabase: { rpc, from } })
  rpc.mockResolvedValue({ error: null })
})

describe("judging server actions", () => {
  it("requires organizer permission for all mutations", async () => {
    await saveJudgingSettings(judging)
    await startJudging(eventId)
    expect(requireAdmin).toHaveBeenCalledTimes(2)
    expect(
      requireAdmin.mock.calls.every(([level]) => level === "organizer")
    ).toBe(true)
  })

  it("does not reach the database when authorization fails", async () => {
    requireAdmin.mockRejectedValue(new Error("Forbidden"))
    await expect(saveJudgingSettings(judging)).rejects.toThrow("Forbidden")
    await expect(startJudging(eventId)).rejects.toThrow("Forbidden")
    expect(rpc).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it("saves the judging fields over the stored submission settings", async () => {
    expect(await saveJudgingSettings(judging)).toEqual({ error: null })
    expect(from).toHaveBeenCalledWith("event_competition_settings")
    expect(rpc).toHaveBeenCalledWith("admin_save_competition_settings", {
      p_event_id: eventId,
      p_enabled: true,
      p_open_at: "2026-11-15T05:00:00.000Z",
      p_close_at: undefined,
      p_judging_close_at: "2026-11-21T05:00:00.000Z",
      p_general_reviews: 3,
    })
    expect(revalidatePath).toHaveBeenCalledWith("/judging")
  })

  it("returns validation errors without database writes", async () => {
    expect(
      (await saveJudgingSettings({ ...judging, judgingEnd: "bad" })).error
    ).toBeTruthy()
    expect(
      (await saveJudgingSettings({ ...judging, generalReviews: 0 })).error
    ).toBeTruthy()
    expect(
      (
        await saveJudgingSettings({
          ...judging,
          judgingEnd: "2026-11-14T00:00",
        })
      ).error
    ).toContain("after the submission dates")
    expect((await startJudging("not-an-id")).error).toBe("Invalid event")
    expect(rpc).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("reports a failed settings read without writing", async () => {
    stored.error = { message: "Settings unavailable" }
    expect(await saveJudgingSettings(judging)).toEqual({
      error: "Settings unavailable",
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("preserves database lifecycle errors without reporting success", async () => {
    rpc.mockResolvedValue({
      error: { message: "Submissions must be closed before judging starts" },
    })
    expect(await startJudging(eventId)).toEqual({
      error: "Submissions must be closed before judging starts",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("revalidates both organizer pages when judging starts", async () => {
    expect(await startJudging(eventId)).toEqual({ error: null })
    expect(revalidatePath).toHaveBeenCalledWith("/judging")
    expect(revalidatePath).toHaveBeenCalledWith("/submission-forms")
  })
})
