import { APPLICATION_FILES_BUCKET, PDF_TYPE } from "@workspace/forms"

import {
  signedFileUrl as signed,
  signedUrlOrThrow,
  uploadPdf as upload,
} from "@workspace/supabase/storage"

import * as files from "./storage-files"

export function uploadPdf(
  path: string,
  file: File,
  onProgress: (percent: number) => void
) {
  return upload({
    client: files.browserClient(),
    bucket: APPLICATION_FILES_BUCKET,
    path,
    file,
    contentType: PDF_TYPE,
    forbidden: "This application no longer accepts file uploads",
    onProgress,
  })
}

export function signedFileUrl(path: string) {
  return signedUrlOrThrow(
    signed(files.browserClient(), APPLICATION_FILES_BUCKET, path)
  )
}

export function removeFiles(paths: string[]) {
  return files.removeFiles(APPLICATION_FILES_BUCKET, paths)
}
