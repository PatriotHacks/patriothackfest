"use server"

import { APPLICATION_FILES_BUCKET } from "@workspace/forms"
import { revalidatePath } from "next/cache"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import { DECISIONS } from "@/lib/roles"

export async function applicationFileUrl(
  applicationId: string,
  path: string
): Promise<ActionResult & { url?: string }> {
  const id = z.guid().parse(applicationId)
  const filePath = z.string().min(1).parse(path)
  if (filePath.split("/")[1] !== id) return { error: "File not found" }
  const { supabase } = await requireAdmin("reviewer")

  const { data, error } = await supabase.storage
    .from(APPLICATION_FILES_BUCKET)
    .createSignedUrl(filePath, 60)
  if (error) return failure(error)
  return { error: null, url: data.signedUrl }
}

export async function setDecisions(
  applicationIds: string[],
  decision: string
): Promise<ActionResult> {
  const ids = z.array(z.guid()).min(1).max(100).parse(applicationIds)
  const value = z.enum(DECISIONS).parse(decision)
  const { supabase } = await requireAdmin("reviewer")

  const { error } = await supabase.from("application_decisions").upsert(
    ids.map((id) => ({ application_id: id, decision: value })),
    { onConflict: "application_id" }
  )
  if (error) return failure(error)

  revalidatePath("/applications", "layout")
  return ok
}
