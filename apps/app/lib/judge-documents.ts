import "server-only"

import * as z from "zod"

import { getApplicant } from "./applicant"
import { judgeRouteSchema } from "./judge-reviews"

export const judgeDocumentsSchema = z.object({
  certificate_path: z.string().nullable(),
  invitation_letter_path: z.string().nullable(),
})
export type JudgeDocuments = z.infer<typeof judgeDocumentsSchema>

export const judgeDocumentInput = z
  .object({
    eventSlug: judgeRouteSchema.shape.eventSlug,
    kind: z.enum(["certificate", "invitation_letter"]),
  })
  .strict()
export type JudgeDocumentKind = z.infer<typeof judgeDocumentInput>["kind"]

export async function getJudgeDocuments(
  slug: string
): Promise<JudgeDocuments | null> {
  const { supabase } = await getApplicant()
  const { data, error } = await supabase.rpc("judge_documents", {
    p_event_slug: slug,
  })
  if (error) throw new Error(error.message)
  return data === null ? null : judgeDocumentsSchema.parse(data)
}
