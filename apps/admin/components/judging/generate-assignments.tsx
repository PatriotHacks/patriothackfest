"use client"

import { Button } from "@workspace/ui/components/button"
import { useRef, useState, useTransition } from "react"
import { generateAssignments } from "@/app/(admin)/judging/assignments-actions"

export function GenerateAssignments({
  eventId,
  started,
}: {
  eventId: string
  started: boolean
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const busy = useRef(false)
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        disabled={!started || pending}
        onClick={() => {
          if (
            busy.current ||
            !window.confirm(
              "Generate missing assignments? Existing reviews and cancelled judge/project pairs will be preserved. Unfillable slots will remain missing."
            )
          )
            return
          busy.current = true
          setMessage(null)
          startTransition(async () => {
            try {
              const result = await generateAssignments({ eventId })
              setMessage(
                result.error ??
                  `${result.summary?.created ?? 0} assignments created; ${result.summary?.missing ?? 0} slots still missing.`
              )
            } catch {
              setMessage("Could not generate assignments. Try again.")
            } finally {
              busy.current = false
            }
          })
        }}
      >
        {pending ? "Generating…" : "Generate missing assignments"}
      </Button>
      {!started && (
        <p className="text-sm text-muted-foreground">
          Close submissions and Start judging before managing assignments.
        </p>
      )}
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </div>
  )
}
