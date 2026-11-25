import { describe, expect, it } from "vitest"

import { judgeProgress } from "./judge-progress"

const row = (n: number, email: string, completed: number, open: number) => ({
  judge_id: `a0000000-0000-4000-8000-00000000000${n}`,
  email,
  active: true,
  completed,
  in_progress: open,
  not_started: 1,
})

describe("judge progress", () => {
  it("totals assignments and sorts lowest completion first, then email", () => {
    const rows = judgeProgress([
      row(1, "c@x.test", 3, 0),
      row(2, "b@x.test", 1, 2),
      row(3, "a@x.test", 2, 0),
      row(4, "d@x.test", 1, 2),
      row(5, "e@x.test", 0, 4),
    ])
    expect(rows.map((r) => r.email)).toEqual([
      "e@x.test",
      "b@x.test",
      "d@x.test",
      "a@x.test",
      "c@x.test",
    ])
    expect(rows[1]).toMatchObject({ completed: 1, total: 4 })
  })
  it("rejects malformed rows", () => {
    expect(() => judgeProgress({})).toThrow()
    expect(() => judgeProgress([{ ...row(1, "a@x.test", -1, 0) }])).toThrow()
    expect(judgeProgress([])).toEqual([])
  })
})
