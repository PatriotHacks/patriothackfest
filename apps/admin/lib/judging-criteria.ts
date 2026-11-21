import * as z from "zod"

export const judgingCriterionInput = z
  .object({
    eventId: z.guid(),
    criterionId: z.guid().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Enter a criterion name")
      .max(120, "Use 120 characters or fewer"),
    description: z.string().trim().max(2000, "Use 2000 characters or fewer"),
  })
  .strict()

export const deleteJudgingCriterionInput = z
  .object({ eventId: z.guid(), criterionId: z.guid() })
  .strict()

export const reorderJudgingCriteriaInput = z
  .object({ eventId: z.guid(), criterionIds: z.array(z.guid()) })
  .strict()

export const judgingCriteriaSchema = z.array(
  z.object({ id: z.guid(), name: z.string(), description: z.string() })
)

export type JudgingCriterionInput = z.input<typeof judgingCriterionInput>
export type JudgingCriterion = z.infer<typeof judgingCriteriaSchema>[number]
