import { describe, expect, it } from "vitest"
import { judgeWindowStatus } from "./judge-status"
describe("judge landing status", () => {
  const cutoff = "2026-11-21T05:00:00Z"
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
