"use client"

import {
  JUDGE_DOCUMENTS_BUCKET,
  PDF_TYPE,
  pdfUploadError,
} from "@workspace/forms"
import { signedUrlOrThrow, uploadPdf } from "@workspace/supabase/storage"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { SignedFileLink } from "@workspace/ui/components/signed-file-link"
import { useId, useRef, useState, useTransition } from "react"

import { judgeDocumentUrl } from "@/app/(admin)/post-judging/actions"
import type { ActionResult } from "@/lib/action-result"
import { browserClient } from "@/lib/browser-client"
import { JUDGE_DOCUMENT_MAX_SIZE_MB } from "@/lib/judge-documents"

export function DocumentControl({
  label,
  path,
  newPath,
  save,
}: {
  label: string
  path: string | null
  newPath: () => string
  save: (path: string | null) => Promise<ActionResult>
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const busy = progress !== null || pending

  async function upload(file: File) {
    const problem = pdfUploadError(file, JUDGE_DOCUMENT_MAX_SIZE_MB)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setProgress(0)
    const next = newPath()
    try {
      await uploadPdf({
        client: browserClient(),
        bucket: JUDGE_DOCUMENTS_BUCKET,
        path: next,
        file,
        forbidden: "Only organizers can upload judge documents",
        onProgress: setProgress,
      })
      setError((await save(next)).error)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function remove() {
    setError(null)
    startTransition(async () => setError((await save(null)).error))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {path ? (
          <>
            <SignedFileLink
              name={label}
              sign={() => signedUrlOrThrow(judgeDocumentUrl(path))}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={remove}
              aria-label={`Remove ${label}`}
            >
              Remove
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">Not uploaded</span>
        )}
      </div>
      <label htmlFor={inputId} className="sr-only">
        {path ? `Replace ${label}` : `Upload ${label}`}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={PDF_TYPE}
        disabled={busy}
        className="text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
        }}
      />
      {progress !== null && (
        <Progress value={progress} aria-label={`Uploading ${label}`} />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
