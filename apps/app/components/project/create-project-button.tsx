"use client"

import { Button } from "@workspace/ui/components/button"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { createProject } from "@/app/(projects)/projects/actions"

export function CreateProjectButton({
  eventId,
  eventSlug,
}: {
  eventId: string
  eventSlug: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            try {
              const result = await createProject(eventId)
              if (result.error) setError(result.error)
              else if (result.projectId)
                router.push(
                  `/projects/${encodeURIComponent(eventSlug)}/${result.projectId}`
                )
            } catch {
              setError("Could not create your project. Try again.")
            }
          })
        }}
      >
        {pending ? "Creating…" : "New project"}
      </Button>
      <p role="status" className="text-sm text-red-700">
        {error}
      </p>
    </div>
  )
}
