import { describe, expect, it } from "vitest"

import { upcomingEvent } from "./events"

const past = {
  slug: "past",
  starts_at: "2026-03-01T14:00:00Z",
  ends_at: "2026-03-02T22:00:00Z",
}
const oneDay = {
  slug: "one-day",
  starts_at: "2026-10-13T14:00:00Z",
  ends_at: null,
}
const later = {
  slug: "later",
  starts_at: "2027-03-01T14:00:00Z",
  ends_at: "2027-03-02T22:00:00Z",
}
const events = [past, oneDay, later]

describe("upcomingEvent", () => {
  it("returns the first event that has not ended", () => {
    expect(upcomingEvent(events, Date.parse("2026-05-01T00:00:00Z"))).toBe(
      oneDay
    )
  })

  it("keeps an event current until the end of its last day in New York", () => {
    expect(upcomingEvent(events, Date.parse("2026-10-14T03:59:00Z"))).toBe(
      oneDay
    )
    expect(upcomingEvent(events, Date.parse("2026-10-14T04:00:00Z"))).toBe(
      later
    )
  })

  it("uses the end date when there is one", () => {
    expect(upcomingEvent(events, Date.parse("2026-03-02T23:00:00Z"))).toBe(past)
  })

  it("falls back to the last event once all have ended", () => {
    expect(upcomingEvent(events, Date.parse("2028-01-01T00:00:00Z"))).toBe(
      later
    )
    expect(upcomingEvent([], Date.now())).toBeNull()
  })

  it("skips events without dates", () => {
    const undated = { slug: "tbd", starts_at: null, ends_at: null }
    expect(
      upcomingEvent([undated, later], Date.parse("2026-05-01T00:00:00Z"))
    ).toBe(later)
  })
})
