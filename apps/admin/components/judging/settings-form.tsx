"use client"

import {
  EVENT_TIME_ZONE,
  formatInZone,
  toZonedInputValue,
} from "@workspace/forms"
import type { Tables } from "@workspace/supabase/types"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useId, useState, useTransition } from "react"

import {
  saveCompetitionSettings,
  startJudging,
} from "@/app/(admin)/judging/actions"
import { judgingEndInputValue } from "@/lib/judging"

export function CompetitionSettingsForm({
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
  const [judgingEnd, setJudgingEnd] = useState(
    judgingEndInputValue(settings?.judging_close_at ?? null)
  )
  const [generalReviews, setGeneralReviews] = useState(
    settings?.general_reviews_per_project ?? 3
  )
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const started = Boolean(settings?.judging_started_at)
  const hasUnsavedChanges =
    enabled !== (settings?.enabled ?? false) ||
    open !==
      (settings?.project_submissions_open_at
        ? toZonedInputValue(settings.project_submissions_open_at)
        : "") ||
    close !==
      (settings?.project_submissions_close_at
        ? toZonedInputValue(settings.project_submissions_close_at)
        : "") ||
    judgingEnd !== judgingEndInputValue(settings?.judging_close_at ?? null) ||
    generalReviews !== (settings?.general_reviews_per_project ?? 3)

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Competition settings</h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          setMessage(null)
          startTransition(async () => {
            try {
              const result = await saveCompetitionSettings({
                eventId,
                enabled,
                open,
                close,
                judgingEnd,
                generalReviews,
              })
              setMessage(result.error ?? "Settings saved")
            } catch {
              setMessage("Could not save settings. Try again.")
            }
          })
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={pending || started}
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
              disabled={pending || started}
              required={enabled}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-close`}>Submissions close (optional)</Label>
            <Input
              id={`${id}-close`}
              type="datetime-local"
              value={close}
              onChange={(event) => setClose(event.target.value)}
              disabled={pending || started}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-end`}>
              Judging ends (final included minute)
            </Label>
            <Input
              id={`${id}-end`}
              type="datetime-local"
              value={judgingEnd}
              onChange={(event) => setJudgingEnd(event.target.value)}
              disabled={pending}
              required={enabled}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-reviews`}>General reviews per project</Label>
            <Input
              id={`${id}-reviews`}
              type="number"
              min={1}
              max={20}
              value={generalReviews}
              onChange={(event) =>
                setGeneralReviews(Number(event.target.value))
              }
              disabled={pending}
              required
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          All times are in {EVENT_TIME_ZONE}. Judging includes the entire
          selected final minute. Deadline extensions apply to subsequent
          requests, even after the old deadline passes.
        </p>
        {!close && (
          <p className="text-sm text-amber-800" role="status">
            No scheduled closing yet. Enabled submissions stay open until you
            set a closing time. Judging cannot start without one.
          </p>
        )}
        <Button type="submit" className="w-fit" disabled={pending}>
          Save settings
        </Button>
      </form>
      {started ? (
        <p className="text-sm">
          Judging started {formatInZone(settings!.judging_started_at!)}. Project
          content, collaborators, tracks, and submission settings are
          permanently locked. You can still extend judging.
        </p>
      ) : (
        <div className="flex flex-col items-start gap-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Save settings first. Start judging only after submissions close.
            This permanently locks project content, collaborators, and tracks.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={
              pending ||
              hasUnsavedChanges ||
              !settings?.enabled ||
              !settings.project_submissions_close_at
            }
            onClick={() => {
              if (
                !window.confirm(
                  "Start judging? Project content, collaborators, tracks, and submission settings will be permanently locked. This cannot be undone."
                )
              )
                return
              setMessage(null)
              startTransition(async () => {
                try {
                  const result = await startJudging(eventId)
                  setMessage(result.error ?? "Judging started")
                } catch {
                  setMessage("Could not start judging. Try again.")
                }
              })
            }}
          >
            Start judging
          </Button>
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </div>
  )
}
