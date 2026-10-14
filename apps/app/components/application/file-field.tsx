"use client"

import {
  applicationFilePath,
  fileAnswerSchema,
  fileMaxSizeMb,
  fileUploadError,
  PDF_TYPE,
  type Field,
  type FileAnswer,
} from "@workspace/forms"
import { Progress } from "@workspace/ui/components/progress"
import { cn } from "@workspace/ui/lib/utils"
import { useRef, useState } from "react"

import { uploadPdf } from "@/lib/application-files"

import { fieldErrorId, fieldInputId } from "./field-ids"
import { FileLink } from "./file-link"
import { TILE } from "./form-controls"

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FileField({
  field,
  value,
  invalid,
  disabled,
  userId,
  applicationId,
  onChange,
  onUploadingChange,
}: {
  field: Extract<Field, { type: "file" }>
  value: unknown
  invalid: boolean
  disabled: boolean
  userId: string
  applicationId: string
  onChange: (value: FileAnswer | undefined) => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const parsed = fileAnswerSchema.safeParse(value)
  const current = parsed.success ? parsed.data : null
  const inputId = fieldInputId(field.id)

  async function upload(file: File) {
    const problem = fileUploadError(field, file)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setProgress(0)
    onUploadingChange(true)
    const path = applicationFilePath({
      userId,
      applicationId,
      fieldId: field.id,
      fileId: crypto.randomUUID(),
    })
    try {
      await uploadPdf(path, file, setProgress)
      onChange({ path, name: file.name, size: file.size, type: PDF_TYPE })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setProgress(null)
      onUploadingChange(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const uploading = progress !== null

  return (
    <div className="flex flex-col gap-[8px]">
      {current && (
        <div className="flex flex-wrap items-center gap-[12px] text-[14.5px]">
          <FileLink path={current.path} name={current.name} />
          <span className="text-[#6E6E68]">{formatSize(current.size)}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              disabled={uploading}
              className="text-[#6E6E68] underline-offset-2 hover:underline disabled:cursor-not-allowed"
            >
              Remove
            </button>
          )}
        </div>
      )}
      {!disabled && (
        <label
          htmlFor={inputId}
          className={cn(
            TILE,
            "justify-between border-dashed has-focus-visible:border-[#3A4A2B] has-focus-visible:ring-2 has-focus-visible:ring-[#3A4A2B]/20",
            (invalid || error !== null) && "border-destructive"
          )}
        >
          <span className="font-semibold text-[#3A4A2B]">
            {uploading
              ? "Uploading..."
              : current
                ? "Replace file"
                : "Choose a PDF"}
          </span>
          <span className="text-[13px] text-[#6E6E68]">
            PDF only, up to {fileMaxSizeMb(field)} MB
          </span>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={PDF_TYPE}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file)
            }}
            disabled={uploading}
            aria-invalid={invalid || error !== null}
            aria-describedby={invalid ? fieldErrorId(field.id) : undefined}
          />
        </label>
      )}
      {uploading && (
        <Progress
          value={progress}
          aria-label={`Uploading ${field.label}`}
          className="[&>[data-slot=progress-indicator]]:bg-[#3A4A2B]"
        />
      )}
      {error && (
        <p role="alert" className="text-[14px] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
