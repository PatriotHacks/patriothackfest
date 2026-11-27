import * as z from "zod"

export const JUDGE_DOCUMENT_MAX_SIZE_MB = 10

export function certificatePath(eventId: string, judgeId: string) {
  return `${eventId}/certificates/${judgeId}/${crypto.randomUUID()}.pdf`
}

export function invitationLetterPath(eventId: string, judgeId: string) {
  return `${eventId}/invitation-letters/${judgeId}/${crypto.randomUUID()}.pdf`
}

export const postJudgingRosterSchema = z.array(
  z.object({
    id: z.guid(),
    email: z.string(),
    guest: z.boolean(),
    certificate_path: z.string().nullable(),
    invitation_letter_path: z.string().nullable(),
  })
)

export const judgeDocumentInput = z
  .object({
    eventId: z.guid(),
    judgeId: z.guid(),
    path: z.string().min(1).nullable(),
  })
  .strict()

export type PostJudgingJudge = z.infer<typeof postJudgingRosterSchema>[number]
