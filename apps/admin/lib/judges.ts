import * as z from "zod"

export const eventJudgeInput = z
  .object({
    eventId: z.guid(),
    judgeId: z.guid().optional(),
    email: z.string().trim().toLowerCase().max(320).pipe(z.email()),
    kind: z.enum(["general", "sponsor"]),
    active: z.boolean(),
    capacity: z.number().int().min(1).max(1000),
    trackIds: z.array(z.guid()),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.kind === "general" && input.trackIds.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["trackIds"],
        message: "General judges cannot have sponsor tracks",
      })
    }
    if (input.kind === "sponsor" && input.trackIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["trackIds"],
        message: "Select at least one sponsor track",
      })
    }
  })

export const eventJudgeRefInput = z
  .object({ eventId: z.guid(), judgeId: z.guid() })
  .strict()

export const judgeGuestInput = eventJudgeRefInput
  .extend({ guest: z.boolean() })
  .strict()

const count = z.number().int().nonnegative()
export const judgeTransferSchema = z.object({
  moved: count,
  dropped_drafts: count,
  missing: count,
})
export const judgeTransferPreviewSchema = z.object({
  unsubmitted: count,
  drafts: count,
})
export const savedJudgeSchema = z.object({
  id: z.guid(),
  transfer: judgeTransferSchema.nullable(),
})

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export function transferPreviewMessage(preview: JudgeTransferPreview) {
  if (preview.unsubmitted === 0) return "No unsubmitted assignments to move."
  return `${plural(preview.unsubmitted, "assignment")} will move to other judges; ${preview.drafts} ${preview.drafts === 1 ? "has" : "have"} draft scores that will be discarded.`
}

export function transferResultMessage(transfer: JudgeTransfer) {
  const moved = `Moved ${plural(transfer.moved, "assignment")}`
  if (transfer.missing === 0) return `${moved}.`
  return `${moved}. ${plural(transfer.missing, "project")} still ${transfer.missing === 1 ? "needs" : "need"} a judge (raise judge limits and click Generate missing assignments).`
}

export const judgeRosterSchema = z.array(
  z.object({
    id: z.guid(),
    event_id: z.guid(),
    email: z.string(),
    kind: z.enum(["general", "sponsor"]),
    active: z.boolean(),
    guest: z.boolean(),
    capacity: z.number().int(),
    bound: z.boolean(),
    has_assignments: z.boolean(),
    workload: z.number().int(),
    scopes: z.array(
      z.object({
        id: z.guid(),
        name: z.string(),
        active: z.boolean(),
        referenced: z.boolean(),
      })
    ),
  })
)

export type EventJudgeInput = z.input<typeof eventJudgeInput>
export type JudgeTransfer = z.infer<typeof judgeTransferSchema>
export type JudgeTransferPreview = z.infer<typeof judgeTransferPreviewSchema>
export type JudgeRosterEntry = z.infer<typeof judgeRosterSchema>[number]
