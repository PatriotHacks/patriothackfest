"use server"

import { JUDGE_DOCUMENTS_BUCKET } from "@workspace/forms"
import type { ServerClient } from "@workspace/supabase/server"
import { signedFileUrl } from "@workspace/supabase/storage"
import { revalidatePath } from "next/cache"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import { judgeDocumentInput } from "@/lib/judge-documents"

async function recordDocument(
  supabase: ServerClient,
  path: string | null,
  request: PromiseLike<{
    data: string | null
    error: { message: string } | null
  }>
): Promise<ActionResult> {
  const { data: previous, error } = await request
  const bucket = supabase.storage.from(JUDGE_DOCUMENTS_BUCKET)
  if (error) {
    if (path) await bucket.remove([path])
    return failure(error)
  }
  revalidatePath("/post-judging")
  if (!previous) return ok
  const removed = await bucket.remove([previous])
  return removed.error ? failure(removed.error) : ok
}

export async function saveJudgeCertificate(
  input: unknown
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = judgeDocumentInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid certificate" })
  const { eventId, judgeId, path } = parsed.data
  return recordDocument(
    supabase,
    path,
    supabase.rpc("admin_set_judge_certificate", {
      p_event_id: eventId,
      p_judge_id: judgeId,
      p_path: path ?? undefined,
    })
  )
}

export async function saveJudgeInvitationLetter(
  input: unknown
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = judgeDocumentInput.safeParse(input)
  if (!parsed.success) return failure({ message: "Invalid invitation letter" })
  const { eventId, judgeId, path } = parsed.data
  return recordDocument(
    supabase,
    path,
    supabase.rpc("admin_set_judge_invitation_letter", {
      p_event_id: eventId,
      p_judge_id: judgeId,
      p_path: path ?? undefined,
    })
  )
}

export async function judgeDocumentUrl(
  path: string
): Promise<ActionResult & { url?: string }> {
  const { supabase } = await requireAdmin("organizer")
  const input = z.string().min(1).safeParse(path)
  if (!input.success) return { error: "File not found" }
  return signedFileUrl(supabase, JUDGE_DOCUMENTS_BUCKET, input.data)
}
