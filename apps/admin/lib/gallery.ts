import { isProjectTextType, type ProjectQuestionType } from "@workspace/forms"
import * as z from "zod"

export function galleryEligible(type: ProjectQuestionType) {
  return type !== "file"
}

export const questionGalleryInput = z
  .object({
    eventId: z.guid(),
    questionId: z.guid(),
    public: z.boolean(),
    summary: z.boolean(),
  })
  .strict()
  .refine((value) => value.public || !value.summary, {
    message: "The gallery summary must be shown in the gallery",
  })

export type QuestionGalleryInput = z.infer<typeof questionGalleryInput>

export function summaryEligible(type: ProjectQuestionType) {
  return isProjectTextType(type)
}
