import { APPLICATION_FILES_BUCKET } from "@workspace/forms"

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
  const { data, error } = await files
    .browserClient()
    .storage.from(APPLICATION_FILES_BUCKET)
    .createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

export function removeFiles(paths: string[]) {
  return files.removeFiles(APPLICATION_FILES_BUCKET, paths)
}
