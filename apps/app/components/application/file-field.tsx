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
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Progress } from "@workspace/ui/components/progress"
import { useRef, useState } from "react"

import { uploadPdf } from "@/lib/application-files"

import { fieldErrorId, fieldInputId } from "./field-ids"
import { FileLink } from "./file-link"

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
    <div className="flex flex-col gap-2">
      {current && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <FileLink path={current.path} name={current.name} />
          <span className="text-muted-foreground">
            {formatSize(current.size)}
          </span>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(undefined)}
              disabled={uploading}
            >
              Remove
            </Button>
          )}
        </div>
      )}
      {!disabled && (
        <Input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={PDF_TYPE}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void upload(file)
          }}
          disabled={uploading}
          aria-invalid={invalid || error !== null}
          aria-describedby={invalid ? fieldErrorId(field.id) : undefined}
        />
      )}
      <p className="text-xs text-muted-foreground">
        {current ? "Choose a file to replace it. " : ""}PDF only, up to{" "}
        {fileMaxSizeMb(field)} MB.
      </p>
      {uploading && (
        <Progress value={progress} aria-label={`Uploading ${field.label}`} />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
