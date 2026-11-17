"use client"

import { useState } from "react"

export function FileLink({
  name,
  sign,
}: {
  name: string
  sign: () => Promise<string>
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
      <button
        type="button"
        className="font-medium text-[#3A4A2B] underline underline-offset-2"
        onClick={open}
        aria-label={`View ${name}`}
      >
        {name}
      </button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </span>
  )
}
