import {
  DEFAULT_FILE_MAX_SIZE_MB,
  MAX_FILE_SIZE_MB,
  type Field,
} from "./schema"

export const APPLICATION_FILES_BUCKET = "application-files"
export const JUDGE_DOCUMENTS_BUCKET = "judge-documents"
export const PDF_TYPE = "application/pdf"

export function applicationFilePath(parts: {
  userId: string
  applicationId: string
  fieldId: string
  fileId: string
}) {
  return `${parts.userId}/${parts.applicationId}/${parts.fieldId}/${parts.fileId}.pdf`
}

export function fileMaxSizeMb(field: Extract<Field, { type: "file" }>) {
  return Math.min(
    field.validation?.max_size_mb ?? DEFAULT_FILE_MAX_SIZE_MB,
    MAX_FILE_SIZE_MB
  )
}

export function pdfUploadError(
  file: { type: string; size: number },
  maxSizeMb: number
) {
  if (file.type !== PDF_TYPE) return "Upload a PDF file"
  if (file.size > maxSizeMb * 1024 * 1024)
    return `Files must be ${maxSizeMb} MB or smaller`
  if (file.size === 0) return "This file is empty"
  return null
}

export function fileUploadError(
  field: Extract<Field, { type: "file" }>,
  file: { type: string; size: number }
) {
  return pdfUploadError(file, fileMaxSizeMb(field))
}
