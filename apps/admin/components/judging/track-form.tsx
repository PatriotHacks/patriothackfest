"use client"

import type { Tables } from "@workspace/supabase/types"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { useId, useState, useTransition } from "react"

import { saveCompetitionTrack } from "@/app/(admin)/judging/actions"

export function CompetitionTrackForm({
  eventId,
  track,
  locked,
}: {
  eventId: string
  track?: Tables<"competition_tracks">
  locked: boolean
}) {
  const id = useId()
  const [name, setName] = useState(track?.name ?? "")
  const [sponsor, setSponsor] = useState(track?.sponsor ?? "")
  const [description, setDescription] = useState(track?.description ?? "")
  const [reviews, setReviews] = useState(track?.reviews_per_project ?? 1)
  const [active, setActive] = useState(track?.active ?? true)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        setMessage(null)
        startTransition(async () => {
          try {
            const result = await saveCompetitionTrack({
              eventId,
              trackId: track?.id,
              name,
              sponsor,
              description,
              reviews,
              active,
            })
            setMessage(result.error ?? (track ? "Track saved" : "Track added"))
            if (!result.error && !track) {
              setName("")
              setSponsor("")
              setDescription("")
              setReviews(1)
              setActive(true)
            }
          } catch {
            setMessage("Could not save track. Try again.")
          }
        })
      }}
    >
      <h3 className="font-semibold">
        {track ? track.name : "Add sponsor track"}
      </h3>
      <fieldset disabled={pending || locked} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-name`}>Track name</Label>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-sponsor`}>Sponsor (optional)</Label>
            <Input
              id={`${id}-sponsor`}
              value={sponsor}
              onChange={(event) => setSponsor(event.target.value)}
              maxLength={120}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-description`}>Description (optional)</Label>
          <Textarea
            id={`${id}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-reviews`}>Sponsor reviews per project</Label>
          <Input
            id={`${id}-reviews`}
            type="number"
            min={1}
            max={20}
            value={reviews}
            onChange={(event) => setReviews(Number(event.target.value))}
            required
            className="max-w-32"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active (available for participant selection)
        </label>
        {!locked && (
          <Button type="submit" variant="outline" className="w-fit">
            {track ? "Save track" : "Add track"}
          </Button>
        )}
      </fieldset>
      {locked && (
        <p className="text-sm text-muted-foreground">
          Track settings are locked because judging has started.
        </p>
      )}
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </form>
  )
}
