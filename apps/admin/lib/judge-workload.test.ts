import { describe, expect, it } from "vitest"

import { judgeWorkload } from "./judge-workload"

describe("judge workload", () => {
  it("splits reviews evenly with floor and ceil", () => {
    expect(judgeWorkload(9, 3, [10, 10, 10, 10, 10, 10])).toEqual({
      needed: 27,
      judges: 6,
      perJudge: 4.5,
      low: 4,
      high: 5,
      capacity: 54,
      shortBy: 0,
      tooFewJudges: false,
    })
  })

  it("reports a capacity shortfall", () => {
    const result = judgeWorkload(10, 3, [5, 5, 5])
    expect(result.capacity).toBe(15)
    expect(result.shortBy).toBe(15)
  })

  it("caps each judge at one review per project", () => {
    expect(judgeWorkload(2, 2, [10, 10]).capacity).toBe(4)
  })

  it("flags more reviews per project than judges", () => {
    const result = judgeWorkload(4, 3, [10, 10])
    expect(result.tooFewJudges).toBe(true)
    expect(result.shortBy).toBe(4)
  })

  it("handles no judges and no projects", () => {
    expect(judgeWorkload(5, 3, [])).toMatchObject({
      perJudge: 0,
      capacity: 0,
      shortBy: 15,
      tooFewJudges: true,
    })
    expect(judgeWorkload(0, 3, [])).toMatchObject({
      needed: 0,
      shortBy: 0,
      tooFewJudges: false,
    })
  })
})
