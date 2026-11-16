"use client"

import { EVENT_TIME_ZONE, toZonedInputValue } from "@workspace/forms"
import type { Tables } from "@workspace/supabase/types"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useId, useState, useTransition } from "react"

import { saveSubmissionSettings } from "@/app/(admin)/submission-forms/actions"

export function SubmissionSettingsForm({
  eventId,
  settings,
}: {
  eventId: string
  settings: Tables<"event_competition_settings"> | null
}) {
  const id = useId()
  const [enabled, setEnabled] = useState(settings?.enabled ?? false)
  const [open, setOpen] = useState(
    settings?.project_submissions_open_at
      ? toZonedInputValue(settings.project_submissions_open_at)
      : ""
  )
  const [close, setClose] = useState(
    settings?.project_submissions_close_at
      ? toZonedInputValue(settings.project_submissions_close_at)
      : ""
  )
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const started = Boolean(settings?.judging_started_at)

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Submission settings</h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          setMessage(null)
          startTransition(async () => {
            try {
              const result = await saveSubmissionSettings({
                eventId,
                enabled,
                open,
                close,
              })
              setMessage(result.error ?? "Settings saved")
            } catch {
              setMessage("Could not save settings. Try again.")
            }
          })
        }}
      >
        <fieldset disabled={pending || started} className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Enable project submissions for this event
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-open`}>Submissions open</Label>
              <Input
                id={`${id}-open`}
                type="datetime-local"
                value={open}
                onChange={(event) => setOpen(event.target.value)}
                required={enabled}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-close`}>
                Submissions close (optional)
              </Label>
              <Input
                id={`${id}-close`}
                type="datetime-local"
                value={close}
                onChange={(event) => setClose(event.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            All times are in {EVENT_TIME_ZONE}. Enabling requires a judging end
            date, set in Judging Management.
          </p>
          {!close && (
            <p className="text-sm text-amber-800" role="status">
              No scheduled closing yet. Enabled submissions stay open until you
              set a closing time. Judging cannot start without one.
            </p>
          )}
          {!started && (
            <Button type="submit" className="w-fit">
              Save settings
            </Button>
          )}
        </fieldset>
      </form>
      {started && (
        <p className="text-sm text-muted-foreground">
          Submission settings are locked because judging has started.
        </p>
      )}
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </div>
  )
}
