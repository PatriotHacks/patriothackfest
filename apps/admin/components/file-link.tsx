"use client"

import { signedUrlOrThrow } from "@workspace/supabase/storage"
import { SignedFileLink } from "@workspace/ui/components/signed-file-link"

import { applicationFileUrl } from "@/app/(admin)/applications/actions"

export function FileLink({
  applicationId,
  path,
  name,
}: {
  applicationId: string
  path: string
  name: string
}) {
  return (
    <SignedFileLink
      name={name}
      sign={() => signedUrlOrThrow(applicationFileUrl(applicationId, path))}
    />
  )
}
