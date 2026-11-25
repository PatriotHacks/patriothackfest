import * as z from "zod"

const count = z.number().int().nonnegative()
export const judgeProgressSchema = z.array(
  z.object({
    judge_id: z.guid(),
    email: z.string(),
    active: z.boolean(),
    completed: count,
    in_progress: count,
    not_started: count,
  })
)
export type JudgeProgress = z.infer<typeof judgeProgressSchema>[number] & {
  total: number
}

export function judgeProgress(data: unknown): JudgeProgress[] {
  return judgeProgressSchema
    .parse(data)
    .map((row) => ({
      ...row,
      total: row.completed + row.in_progress + row.not_started,
    }))
    .sort(
      (a, b) =>
        a.completed * b.total - b.completed * a.total ||
        a.email.localeCompare(b.email)
    )
}
