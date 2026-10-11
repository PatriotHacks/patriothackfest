import { APPLICATION_FILES_BUCKET, PDF_TYPE } from "@workspace/forms"
import { createClient } from "@workspace/supabase/client"
import * as z from "zod"

import { AUTH_COOKIE } from "./auth-cookie"

let client: ReturnType<typeof createClient> | null = null

function browserClient() {
  client ??= createClient(AUTH_COOKIE)
  return client
}

const storageError = z.object({ message: z.string() })

function uploadError(xhr: XMLHttpRequest) {
  if (xhr.status === 403)
    return "This application no longer accepts file uploads"
  if (xhr.status === 413) return "This file is too large"
  try {
    return storageError.parse(JSON.parse(xhr.responseText)).message
  } catch {
    return "Upload failed"
  }
}

export async function uploadPdf(
  path: string,
  file: File,
  onProgress: (percent: number) => void
) {
  const { data, error } = await browserClient().auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error("Your session has ended. Sign in again.")
  const token = data.session.access_token

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(
      "POST",
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${APPLICATION_FILES_BUCKET}/${path}`
    )
    xhr.setRequestHeader("authorization", `Bearer ${token}`)
    xhr.setRequestHeader(
      "apikey",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
    xhr.setRequestHeader("content-type", PDF_TYPE)
    xhr.setRequestHeader("x-upsert", "false")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(uploadError(xhr)))
    xhr.onerror = () =>
      reject(new Error("Upload failed. Check your connection and try again."))
    xhr.send(file)
  })
}

export async function signedFileUrl(path: string) {
  const { data, error } = await browserClient()
    .storage.from(APPLICATION_FILES_BUCKET)
    .createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

export async function removeFiles(paths: string[]) {
  if (paths.length === 0) return
  await browserClient().storage.from(APPLICATION_FILES_BUCKET).remove(paths)
}
