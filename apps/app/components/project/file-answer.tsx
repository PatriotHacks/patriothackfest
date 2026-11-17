"use client"

import {
  pdfUploadError,
  PDF_TYPE,
  projectFileMaxSizeMb,
  projectFilePath,
  type FileAnswer,
  type ProjectQuestion,
} from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { useRef, useState } from "react"

import { projectFileUrl } from "@/lib/project-file-actions"
import { FileLink } from "@/components/application/file-link"
import { uploadProjectPdf } from "@/lib/project-files"

import { signedUrlOrThrow } from "./answer-view"

export function ProjectFileAnswer({
  inputId,
  projectId,
  question,
  value,
  invalid,
  describedBy,
  onChange,
  onUploaded,
  onUploadingChange,
}: {
  inputId: string
  projectId: string
  question: ProjectQuestion
  value: FileAnswer | null
  invalid: boolean
  describedBy: string | undefined
  onChange: (value: FileAnswer | null) => void
  onUploaded: (path: string) => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const maxSizeMb = projectFileMaxSizeMb(question)
  const uploading = progress !== null

  async function upload(file: File) {
    const problem = pdfUploadError(file, maxSizeMb)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setProgress(0)
    onUploadingChange(true)
    const path = projectFilePath({
      projectId,
      questionId: question.id,
      fileId: crypto.randomUUID(),
    })
    try {
      await uploadProjectPdf(path, file, setProgress)
      onUploaded(path)
      onChange({ path, name: file.name, size: file.size, type: PDF_TYPE })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setProgress(null)
      onUploadingChange(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <FileLink
            name={value.name}
            sign={() => signedUrlOrThrow(projectFileUrl(value.path))}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading}
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        </div>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={PDF_TYPE}
        disabled={uploading}
        aria-invalid={invalid || error !== null}
        aria-describedby={describedBy}
        className="text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
        }}
      />
      <p className="text-xs text-[#6E6E68]">
        {value ? "Choosing a file replaces the current one. " : ""}PDF only, up
        to {maxSizeMb} MB
      </p>
      {uploading && (
        <Progress value={progress} aria-label={`Uploading ${question.label}`} />
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
