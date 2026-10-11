"use server"

import { APPLICATION_FILES_BUCKET } from "@workspace/forms"
import * as z from "zod"

import { failure, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"

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
