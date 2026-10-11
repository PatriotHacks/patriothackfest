import { describe, expect, it } from "vitest"

import {
  formatInZone,
  fromZonedInputValue,
  toZonedInputValue,
} from "./time-zone"

describe("time zone helpers", () => {
  it("converts New York wall-clock time to UTC across DST", () => {
    expect(fromZonedInputValue("2026-07-01T12:00")).toBe(
      "2026-07-01T16:00:00.000Z"
    )
    expect(fromZonedInputValue("2026-12-01T12:00")).toBe(
      "2026-12-01T17:00:00.000Z"
    )
  })

  it("converts UTC to a New York datetime-local value", () => {
    expect(toZonedInputValue("2026-07-01T16:00:00Z")).toBe("2026-07-01T12:00")
    expect(toZonedInputValue("2026-12-01T04:59:00+00:00")).toBe(
      "2026-11-30T23:59"
    )
  })

  it("round-trips around the fall-back transition", () => {
    const iso = fromZonedInputValue("2026-11-01T00:30")
    expect(toZonedInputValue(iso)).toBe("2026-11-01T00:30")
  })

  it("formats with the zone abbreviation", () => {
    expect(formatInZone("2026-12-01T17:00:00Z")).toBe(
      "Dec 1, 2026, 12:00 PM EST"
    )
  })

  it("rejects malformed input", () => {
    expect(() => fromZonedInputValue("2026-12-01")).toThrow()
  })
})
