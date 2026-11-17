"use client"

import { Button } from "@workspace/ui/components/button"
import { useState } from "react"

import { applicationFileUrl } from "@/app/(admin)/applications/actions"
import { projectFileUrl } from "@/app/(admin)/submission-forms/actions"
import type { ActionResult } from "@/lib/action-result"

function SignedFileLink({
  name,
  sign,
}: {
  name: string
  sign: () => Promise<ActionResult & { url?: string }>
}) {
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setError(null)
    const tab = window.open("", "_blank")
    if (!tab) {
      setError("Allow pop-ups to view this file")
      return
    }
    try {
      const result = await sign()
      if (!result.url) throw new Error(result.error ?? "File not found")
      tab.opener = null
      tab.location.href = result.url
    } catch (e) {
      tab.close()
      setError(e instanceof Error ? e.message : "Could not open the file")
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="link"
        className="h-auto p-0"
        onClick={open}
        aria-label={`View ${name}`}
      >
        {name}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </span>
  )
}

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
      sign={() => applicationFileUrl(applicationId, path)}
    />
  )
}

export function ProjectFileLink({
  projectId,
  path,
  name,
}: {
  projectId: string
  path: string
  name: string
}) {
  return (
    <SignedFileLink name={name} sign={() => projectFileUrl(projectId, path)} />
  )
}
