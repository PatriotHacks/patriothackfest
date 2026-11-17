import { APPLICATION_FILES_BUCKET } from "@workspace/forms"

import { signedFileUrl as signed } from "@workspace/supabase/storage"

import * as files from "./storage-files"

export function uploadPdf(
  path: string,
  file: File,
  onProgress: (percent: number) => void
) {
  return files.uploadPdf({
    bucket: APPLICATION_FILES_BUCKET,
    path,
    file,
    forbidden: "This application no longer accepts file uploads",
    onProgress,
  })
}

export async function signedFileUrl(path: string) {
  const result = await signed(
    files.browserClient(),
    APPLICATION_FILES_BUCKET,
    path
  )
  if (!result.url) throw new Error(result.error ?? "File not found")
  return result.url
}

export function removeFiles(paths: string[]) {
  return files.removeFiles(APPLICATION_FILES_BUCKET, paths)
}
