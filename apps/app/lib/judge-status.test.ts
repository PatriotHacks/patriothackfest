import { describe, expect, it } from "vitest"
import {
  formatSubmissionDeadline,
  judgeWindowStatus,
  allJudgingClosed,
  judgingClosed,
  submissionsStillOpen,
} from "./judge-status"
describe("judge landing status", () => {
  const cutoff = "2026-11-21T05:00:00Z"
  it("does not claim judging is open when disabled or missing a deadline", () => {
    expect(
      judgeWindowStatus(
        {
          enabled: false,
          judging_started_at: cutoff,
          judging_close_at: cutoff,
        },
        0
      )
    ).toBe("not-started")
    expect(
      judgeWindowStatus(
        { enabled: true, judging_started_at: cutoff, judging_close_at: null },
        0
      )
    ).toBe("ended")
  })
  it("shows a waiting state without denying the landing page", () => {
    expect(
      judgeWindowStatus({ judging_started_at: null, judging_close_at: cutoff })
    ).toBe("not-started")
  })
  it("uses the exclusive deadline and reflects extensions", () => {
    const now = Date.parse(cutoff)
    expect(
      judgeWindowStatus(
        {
          judging_started_at: "2026-11-18T00:00:00Z",
          judging_close_at: cutoff,
        },
        now - 1
      )
    ).toBe("started")
    expect(
      judgeWindowStatus(
        {
          judging_started_at: "2026-11-18T00:00:00Z",
          judging_close_at: cutoff,
        },
        now
      )
    ).toBe("ended")
    expect(
      judgeWindowStatus(
        {
          judging_started_at: "2026-11-18T00:00:00Z",
          judging_close_at: "2026-11-22T05:00:00Z",
        },
        now
      )
    ).toBe("started")
  })
})
describe("judging closed gate", () => {
  const close = "2026-11-21T05:00:00Z"
  it("closes at the exclusive deadline", () => {
    expect(
      judgingClosed({ judging_close_at: close }, Date.parse(close) - 1)
    ).toBe(false)
    expect(judgingClosed({ judging_close_at: close }, Date.parse(close))).toBe(
      true
    )
  })
  it("stays open without a deadline", () => {
    expect(judgingClosed({ judging_close_at: null })).toBe(false)
  })
  it("treats the judge as done only when every event has closed", () => {
    const now = Date.parse(close)
    const open = { judging_close_at: "2026-11-22T05:00:00Z" }
    expect(allJudgingClosed([{ judging_close_at: close }], now)).toBe(true)
    expect(allJudgingClosed([{ judging_close_at: close }, open], now)).toBe(
      false
    )
    expect(allJudgingClosed([], now)).toBe(false)
  })
})
describe("submission period gate", () => {
  const close = "2026-11-21T04:59:00Z"
  it("hides assignments until the submission deadline passes", () => {
    expect(submissionsStillOpen(close, Date.parse(close) - 1)).toBe(true)
    expect(submissionsStillOpen(close, Date.parse(close))).toBe(false)
  })
  it("formats the deadline in event time", () => {
    expect(formatSubmissionDeadline(close)).toBe("Nov 20th 11:59pm")
    expect(formatSubmissionDeadline("2026-11-22T15:05:00Z")).toBe(
      "Nov 22nd 10:05am"
    )
  })
})
