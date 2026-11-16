"use client"

import { useState, useTransition } from "react"

import { setJudgesSeeAnswers } from "@/app/(admin)/submission-forms/actions"

export function JudgeVisibilityToggle({
  eventId,
  enabled,
}: {
  eventId: string
  enabled: boolean
}) {
  const [checked, setChecked] = useState(enabled)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(event) => {
            const value = event.target.checked
            setMessage(null)
            startTransition(async () => {
              try {
                const result = await setJudgesSeeAnswers(eventId, value)
                if (result.error) {
                  setMessage(result.error)
                  return
                }
                setChecked(value)
                setMessage(
                  value
                    ? "Judges can now see question answers"
                    : "Question answers are hidden from judges"
                )
              } catch {
                setMessage("Could not update judge visibility. Try again.")
              }
            })
          }}
        />
        Judges can see question answers
      </label>
      <p className="text-sm text-muted-foreground">
        Applies to every question for this event and can be changed at any time,
        including during judging. Organizers always see answers.
      </p>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </div>
  )
}
