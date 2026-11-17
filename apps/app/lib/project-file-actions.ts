"use server"

import { PROJECT_FILES_BUCKET } from "@workspace/forms"
import { signedFileUrl } from "@workspace/supabase/storage"
import * as z from "zod"

import { getApplicant } from "./applicant"

export async function projectFileUrl(path: string) {
  const { supabase } = await getApplicant()
  const input = z.string().min(1).safeParse(path)
  if (!input.success) return { error: "File not found" }
  return signedFileUrl(supabase, PROJECT_FILES_BUCKET, input.data)
}
