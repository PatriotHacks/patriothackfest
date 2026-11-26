"use client"

import { signedUrlOrThrow } from "@workspace/supabase/storage"

import { judgeDocumentUrl } from "@/app/(judge)/judge/certificate/actions"
import { FileLink } from "@/components/application/file-link"
import type { JudgeDocumentKind } from "@/lib/judge-documents"

export function JudgeDocumentLink({
  eventSlug,
  kind,
  name,
}: {
  eventSlug: string
  kind: JudgeDocumentKind
  name: string
}) {
  return (
    <FileLink
      name={name}
      sign={() => signedUrlOrThrow(judgeDocumentUrl({ eventSlug, kind }))}
    />
  )
}
