import { PROJECT_FILES_BUCKET } from "@workspace/forms"
import { uploadPdf } from "@workspace/supabase/storage"

import * as files from "./storage-files"

export function uploadProjectPdf(
  path: string,
  file: File,
  onProgress: (percent: number) => void
) {
  return uploadPdf({
    client: files.browserClient(),
    bucket: PROJECT_FILES_BUCKET,
    path,
    file,
    forbidden: "This project no longer accepts file uploads",
    onProgress,
  })
}

export function removeProjectFiles(paths: string[]) {
  return files.removeFiles(PROJECT_FILES_BUCKET, paths)
}
