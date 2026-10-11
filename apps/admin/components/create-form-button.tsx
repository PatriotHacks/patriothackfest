"use client"

import { Button } from "@workspace/ui/components/button"
import { useState, useTransition } from "react"

import { createForm } from "@/app/(admin)/forms/actions"

export function CreateFormButton({
  eventId,
  role,
}: {
  eventId: string
  role: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await createForm(eventId, role)
            setError(result.error)
          })
        }
      >
        Create form
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  )
}
