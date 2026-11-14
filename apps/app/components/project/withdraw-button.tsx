"use client"

import { Button } from "@workspace/ui/components/button"
import { useState, useTransition } from "react"
import { withdrawProject } from "@/app/(projects)/projects/actions"

export function WithdrawProjectButton({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <div className="flex flex-col items-start gap-2 border-t pt-4">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "Withdraw this project? This is final and removes it from judging. Your admissions application will not change."
            )
          )
            return
          startTransition(async () => {
            try {
              const result = await withdrawProject(projectId)
              setMessage(result.error ?? "Project withdrawn")
            } catch {
              setMessage("Could not withdraw project. Try again.")
            }
          })
        }}
      >
        Withdraw project
      </Button>
      <p role="status" className="text-sm">
        {message}
      </p>
    </div>
  )
}
