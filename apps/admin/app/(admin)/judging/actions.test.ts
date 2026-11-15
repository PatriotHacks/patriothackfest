import { beforeEach, describe, expect, it, vi } from "vitest"

const { rpc, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath }))

import {
  saveCompetitionSettings,
  saveCompetitionTrack,
  startJudging,
} from "./actions"

const eventId = "e0000000-0000-4000-8000-000000000001"
const settings = {
  eventId,
  enabled: true,
  open: "2026-11-15T00:00",
  close: "",
  judgingEnd: "2026-11-20T23:59",
  generalReviews: 3,
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue({ supabase: { rpc } })
  rpc.mockResolvedValue({ error: null })
})

describe("judging server actions", () => {
  it("requires organizer permission for all mutations", async () => {
    await saveCompetitionSettings(settings)
    await saveCompetitionTrack({
      eventId,
      name: "Track",
      sponsor: "",
      description: "",
      reviews: 1,
      active: true,
    })
    await startJudging(eventId)
    expect(requireAdmin).toHaveBeenCalledTimes(3)
    expect(
      requireAdmin.mock.calls.every(([level]) => level === "organizer")
    ).toBe(true)
  })

  it("does not reach the database when authorization fails", async () => {
    requireAdmin.mockRejectedValue(new Error("Forbidden"))
    await expect(saveCompetitionSettings(settings)).rejects.toThrow("Forbidden")
    await expect(
      saveCompetitionTrack({
        eventId,
        name: "Track",
        sponsor: "",
        description: "",
        reviews: 1,
        active: true,
      })
    ).rejects.toThrow("Forbidden")
    await expect(startJudging(eventId)).rejects.toThrow("Forbidden")
    expect(rpc).not.toHaveBeenCalled()
  })

  it("sends the inclusive-minute cutoff correctly and allows no closing", async () => {
    expect(await saveCompetitionSettings(settings)).toEqual({ error: null })
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
      (await saveCompetitionSettings({ ...settings, open: "bad" })).error
    ).toBeTruthy()
    expect(
      (await saveCompetitionSettings({ ...settings, close: settings.open }))
        .error
    ).toContain("after opening")
    expect(
      (
        await saveCompetitionTrack({
          eventId,
          name: " ",
          sponsor: "",
          description: "",
          reviews: 1,
          active: true,
        })
      ).error
    ).toBeTruthy()
    expect((await startJudging("not-an-id")).error).toBe("Invalid event")
    expect(rpc).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
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

  it("scopes track updates to the specified event", async () => {
    const trackId = "d0000000-0000-4000-8000-000000000001"
    await saveCompetitionTrack({
      eventId,
      trackId,
      name: "  Track  ",
      sponsor: " Sponsor ",
      description: "",
      reviews: 2,
      active: false,
    })
    expect(rpc).toHaveBeenCalledWith("admin_save_competition_track", {
      p_event_id: eventId,
      p_track_id: trackId,
      p_name: "Track",
      p_sponsor: "Sponsor",
      p_description: "",
      p_reviews: 2,
      p_active: false,
    })
  })
})
