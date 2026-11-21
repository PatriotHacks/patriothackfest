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

export const deleteEventJudgeInput = z
  .object({ eventId: z.guid(), judgeId: z.guid() })
  .strict()

export const judgeRosterSchema = z.array(
  z.object({
    id: z.guid(),
    event_id: z.guid(),
    email: z.string(),
    kind: z.enum(["general", "sponsor"]),
    active: z.boolean(),
    capacity: z.number().int(),
    bound: z.boolean(),
    briefing_acknowledged_at: z.string().nullable(),
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
export type JudgeRosterEntry = z.infer<typeof judgeRosterSchema>[number]
