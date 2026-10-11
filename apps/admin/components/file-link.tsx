"use client"

import { Button } from "@workspace/ui/components/button"
import { useState } from "react"

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
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setError(null)
    const tab = window.open("", "_blank")
    if (!tab) {
      setError("Allow pop-ups to view this file")
      return
    }
    try {
      const result = await applicationFileUrl(applicationId, path)
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
