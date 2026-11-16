"use client"

import { EVENT_TIME_ZONE, formatInZone } from "@workspace/forms"
import type { Tables } from "@workspace/supabase/types"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useId, useState, useTransition } from "react"

import {
  saveJudgingSettings,
  startJudging,
} from "@/app/(admin)/judging/actions"
import { judgingEndInputValue } from "@/lib/judging"

export function JudgingSettingsForm({
  eventId,
  settings,
}: {
  eventId: string
  settings: Tables<"event_competition_settings"> | null
}) {
  const id = useId()
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
    judgingEnd !== judgingEndInputValue(settings?.judging_close_at ?? null) ||
    generalReviews !== (settings?.general_reviews_per_project ?? 3)

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Judging settings</h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          setMessage(null)
          startTransition(async () => {
            try {
              const result = await saveJudgingSettings({
                eventId,
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
        <div className="grid gap-4 sm:grid-cols-2">
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
              required={settings?.enabled ?? false}
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
          requests, even after the old deadline passes. Submission dates are
          managed in Submission Forms.
        </p>
        <Button type="submit" className="w-fit" disabled={pending}>
          Save settings
        </Button>
      </form>
      {started ? (
        <p className="text-sm">
          Judging started {formatInZone(settings!.judging_started_at!)}. Project
          content, collaborators, tracks, questions, and submission settings are
          permanently locked. You can still extend judging.
        </p>
      ) : (
        <div className="flex flex-col items-start gap-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Save settings first. Start judging only after submissions close.
            This permanently locks project content, collaborators, tracks, and
            questions.
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
                  "Start judging? Project content, collaborators, tracks, questions, and submission settings will be permanently locked. This cannot be undone."
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
