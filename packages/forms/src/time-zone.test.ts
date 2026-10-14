import { describe, expect, it } from "vitest"

import {
  endOfDayInZone,
  formatDateRangeInZone,
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

describe("formatDateRangeInZone", () => {
  it("formats a same-month range without rolling the 23:59:59 ET end", () => {
    expect(
      formatDateRangeInZone("2026-11-14T05:00:00Z", "2026-11-16T04:59:59Z")
    ).toBe("Nov 14–15, 2026")
    expect(
      formatDateRangeInZone("2027-03-19T04:00:00Z", "2027-03-22T03:59:59Z")
    ).toBe("Mar 19–21, 2027")
  })

  it("formats a range spanning months and a DST change", () => {
    expect(
      formatDateRangeInZone("2026-10-31T04:00:00Z", "2026-11-02T04:59:59Z")
    ).toBe("Oct 31 – Nov 1, 2026")
    expect(
      formatDateRangeInZone("2027-03-30T04:00:00Z", "2027-04-02T03:59:59Z")
    ).toBe("Mar 30 – Apr 1, 2027")
  })

  it("formats a range spanning years", () => {
    expect(
      formatDateRangeInZone("2027-01-01T04:59:59Z", "2027-01-02T04:59:59Z")
    ).toBe("Dec 31, 2026 – Jan 1, 2027")
  })

  it("formats a single date when there is no end or it is the same day", () => {
    expect(formatDateRangeInZone("2026-11-14T05:00:00Z", null)).toBe(
      "Nov 14, 2026"
    )
    expect(
      formatDateRangeInZone("2026-11-14T05:00:00Z", "2026-11-15T04:59:59Z")
    ).toBe("Nov 14, 2026")
  })

  it("finds the end of the New York day containing an instant", () => {
    expect(endOfDayInZone("2026-07-01T16:00:00Z")).toBe(
      "2026-07-02T04:00:00.000Z"
    )
    expect(endOfDayInZone("2026-12-01T04:30:00Z")).toBe(
      "2026-12-01T05:00:00.000Z"
    )
    expect(endOfDayInZone("2026-12-31T20:00:00Z")).toBe(
      "2027-01-01T05:00:00.000Z"
    )
    expect(endOfDayInZone("2026-11-01T12:00:00Z")).toBe(
      "2026-11-02T05:00:00.000Z"
    )
  })
})
