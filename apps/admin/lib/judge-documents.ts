import * as z from "zod"

export const JUDGE_DOCUMENT_MAX_SIZE_MB = 10

export function certificatePath(eventId: string, judgeId: string) {
  return `${eventId}/certificates/${judgeId}/${crypto.randomUUID()}.pdf`
}

export function invitationLetterPath(eventId: string) {
  return `${eventId}/invitation-letter/${crypto.randomUUID()}.pdf`
}

export const postJudgingRosterSchema = z.array(
  z.object({
    id: z.guid(),
    email: z.string(),
    guest: z.boolean(),
    receives_invitation: z.boolean(),
    certificate_path: z.string().nullable(),
  })
)

const path = z.string().min(1).nullable()

export const judgeInvitationInput = z
  .object({ eventId: z.guid(), judgeId: z.guid(), receives: z.boolean() })
  .strict()

export const judgeCertificateInput = z
  .object({ eventId: z.guid(), judgeId: z.guid(), path })
  .strict()

export const invitationLetterInput = z
  .object({ eventId: z.guid(), path })
  .strict()

export type PostJudgingJudge = z.infer<typeof postJudgingRosterSchema>[number]
