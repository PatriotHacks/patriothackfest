"use server"

import { JUDGE_DOCUMENTS_BUCKET } from "@workspace/forms"
import { signedFileUrl } from "@workspace/supabase/storage"

import { getApplicant } from "@/lib/applicant"
import { getJudgeDocuments, judgeDocumentInput } from "@/lib/judge-documents"

export async function judgeDocumentUrl(
  input: unknown
): Promise<{ error: string | null; url?: string }> {
  const { supabase } = await getApplicant()
  const parsed = judgeDocumentInput.safeParse(input)
  if (!parsed.success) return { error: "File not found" }
  const documents = await getJudgeDocuments(parsed.data.eventSlug)
  const path =
    parsed.data.kind === "certificate"
      ? documents?.certificate_path
      : documents?.invitation_letter_path
  if (!path) return { error: "File not found" }
  return signedFileUrl(supabase, JUDGE_DOCUMENTS_BUCKET, path)
}
