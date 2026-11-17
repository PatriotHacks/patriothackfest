"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"

export function SignedFileLink({
  name,
  sign,
}: {
  name: string
  sign: () => Promise<string>
}) {
  const [error, setError] = React.useState<string | null>(null)

  async function open() {
    setError(null)
    const tab = window.open("", "_blank")
    if (!tab) {
      setError("Allow pop-ups to view this file")
      return
    }
    try {
      const url = await sign()
      tab.opener = null
      tab.location.href = url
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
