"use server"

import { PROJECT_FILES_BUCKET } from "@workspace/forms"
import { signedFileUrl } from "@workspace/supabase/storage"
import * as z from "zod"

import type { ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"

export async function projectFileUrl(
  path: string
): Promise<ActionResult & { url?: string }> {
  const { supabase } = await requireAdmin("organizer")
  const input = z.string().min(1).safeParse(path)
  if (!input.success) return { error: "File not found" }
  return signedFileUrl(supabase, PROJECT_FILES_BUCKET, input.data)
}
