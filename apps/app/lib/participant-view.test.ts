import { describe, expect, it } from "vitest"
import { participantView } from "./participant-view"

const now = Date.parse("2026-11-17T12:00:00Z")
const spring = {
  starts_at: "2026-03-01T14:00:00Z",
  ends_at: "2026-03-02T22:00:00Z",
}
const fall = {
  starts_at: "2026-11-20T14:00:00Z",
  ends_at: "2026-11-21T22:00:00Z",
}
const later = { starts_at: "2027-03-01T14:00:00Z", ends_at: null }

describe("participantView", () => {
  it("is participant without applications", () => {
    expect(participantView([], now)).toBe("participant")
  })
  it("is mentor when the current event application is a volunteer", () => {
    expect(
      participantView(
        [
          { role: "participant", events: spring },
          { role: "volunteer", events: fall },
        ],
        now
      )
    ).toBe("mentor")
  })
  it("is participant when the current event application is a participant", () => {
    expect(
      participantView(
        [
          { role: "volunteer", events: spring },
          { role: "participant", events: fall },
        ],
        now
      )
    ).toBe("participant")
  })
  it("uses the earliest event that has not ended regardless of input order", () => {
    expect(
      participantView(
        [
          { role: "participant", events: later },
          { role: "volunteer", events: fall },
        ],
        now
      )
    ).toBe("mentor")
  })
  it("is participant when every application's event has ended", () => {
    expect(participantView([{ role: "volunteer", events: spring }], now)).toBe(
      "participant"
    )
  })
})
