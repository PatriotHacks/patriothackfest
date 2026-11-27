import type { SupabaseClient } from "@supabase/supabase-js"

export const SIGNED_URL_SECONDS = 60

export async function signedFileUrl(
  client: Pick<SupabaseClient, "storage">,
  bucket: string,
  path: string
): Promise<{ error: string | null; url?: string }> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS)
  return error ? { error: error.message } : { error: null, url: data.signedUrl }
}

export async function signedUrlOrThrow(
  request: Promise<{ error: string | null; url?: string }>
) {
  const result = await request
  if (!result.url) throw new Error(result.error ?? "File not found")
  return result.url
}

function storageMessage(text: string) {
  try {
    const body: unknown = JSON.parse(text)
    return typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
      ? body.message
      : null
  } catch {
    return null
  }
}

function uploadError(xhr: XMLHttpRequest, forbidden: string) {
  if (xhr.status === 403) return forbidden
  if (xhr.status === 413) return "This file is too large"
  return storageMessage(xhr.responseText) ?? "Upload failed"
}

export async function uploadPdf({
  client,
  bucket,
  path,
  file,
  contentType,
  forbidden,
  onProgress,
}: {
  client: Pick<SupabaseClient, "auth">
  bucket: string
  path: string
  file: File
  contentType: string
  forbidden: string
  onProgress: (percent: number) => void
}) {
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error("Your session has ended. Sign in again.")
  const token = data.session.access_token

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(
      "POST",
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`
    )
    xhr.setRequestHeader("authorization", `Bearer ${token}`)
    xhr.setRequestHeader(
      "apikey",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
    xhr.setRequestHeader("content-type", contentType)
    xhr.setRequestHeader("x-upsert", "false")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(uploadError(xhr, forbidden)))
    xhr.onerror = () =>
      reject(new Error("Upload failed. Check your connection and try again."))
    xhr.send(file)
  })
}
