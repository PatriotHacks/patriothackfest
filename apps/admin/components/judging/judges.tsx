"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useId, useState, useTransition } from "react"

import { saveEventJudge } from "@/app/(admin)/judging/judges-actions"
import type { JudgeRosterEntry } from "@/lib/judges"

type Track = { id: string; name: string; active: boolean }

export function EventJudgeForm({
  eventId,
  tracks,
  judge,
}: {
  eventId: string
  tracks: Track[]
  judge?: JudgeRosterEntry
}) {
  const id = useId()
  const [email, setEmail] = useState(judge?.email ?? "")
  const [kind, setKind] = useState<"general" | "sponsor">(
    judge?.kind ?? "general"
  )
  const [active, setActive] = useState(judge?.active ?? true)
  const [capacity, setCapacity] = useState(judge?.capacity ?? 20)
  const [trackIds, setTrackIds] = useState(
    judge?.scopes.map((scope) => scope.id) ?? []
  )
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const existingScopes = judge?.scopes ?? []

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        setMessage(null)
        startTransition(async () => {
          try {
            const result = await saveEventJudge({
              eventId,
              judgeId: judge?.id,
              email,
              kind,
              active,
              capacity,
              trackIds,
            })
            setMessage(
              result.error ??
                (judge
                  ? "Judge saved"
                  : "Judge added; no invitation email was sent")
            )
            if (!result.error) {
              if (!judge) {
                setEmail("")
                setKind("general")
                setActive(true)
                setCapacity(20)
                setTrackIds([])
              } else setEmail(email.trim().toLowerCase())
            }
          } catch {
            setMessage("Could not save judge. Try again.")
          }
        })
      }}
    >
      <div>
        <h3 className="font-semibold">{judge ? judge.email : "Add judge"}</h3>
        {judge && (
          <p className="text-sm text-muted-foreground">
            {judge.active ? "Active" : "Inactive"} ·{" "}
            {judge.bound ? "Account linked" : "Not linked yet"} ·{" "}
            {judge.workload} assigned reviews
          </p>
        )}
      </div>
      <fieldset disabled={pending} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-email`}>Judge email</Label>
            <Input
              id={`${id}-email`}
              type="email"
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={Boolean(judge?.has_assignments && !judge.bound)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-kind`}>Judge type</Label>
            <select
              id={`${id}-kind`}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={kind}
              disabled={judge?.has_assignments}
              onChange={(event) => {
                const next = event.target.value as "general" | "sponsor"
                setKind(next)
                if (next === "general") setTrackIds([])
              }}
            >
              <option value="general">General</option>
              <option value="sponsor">Sponsor</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-capacity`}>Assignment capacity</Label>
            <Input
              id={`${id}-capacity`}
              type="number"
              min={1}
              max={1000}
              value={capacity}
              onChange={(event) => setCapacity(Number(event.target.value))}
              required
            />
          </div>
        </div>
        {judge?.bound && (
          <p className="text-sm text-muted-foreground">
            This entry is linked to an account. An email correction must match
            that same account's current verified email; it cannot transfer
            access to someone else.
          </p>
        )}
        {judge?.has_assignments && (
          <p className="text-sm text-muted-foreground">
            Judge type and assignment-referenced tracks cannot change. Capacity
            changes never remove existing work.
          </p>
        )}
        {kind === "sponsor" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-semibold">Sponsor tracks</legend>
            {tracks
              .filter(
                (track) =>
                  track.active ||
                  existingScopes.some((scope) => scope.id === track.id)
              )
              .map((track) => {
                const referenced = existingScopes.some(
                  (scope) => scope.id === track.id && scope.referenced
                )
                const checked = trackIds.includes(track.id)
                return (
                  <label
                    key={track.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={referenced || (!track.active && !checked)}
                      onChange={(event) =>
                        setTrackIds(
                          event.target.checked
                            ? [...trackIds, track.id]
                            : trackIds.filter((value) => value !== track.id)
                        )
                      }
                    />
                    {track.name}
                    {!track.active && " (inactive)"}
                    {referenced && " — required by existing assignments"}
                  </label>
                )
              })}
            {!tracks.some((track) => track.active) && (
              <p className="text-sm text-muted-foreground">
                Add an active sponsor track before assigning new sponsor scopes.
              </p>
            )}
          </fieldset>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active — uncheck and save to deactivate
        </label>
        <Button type="submit" variant="outline" className="w-fit">
          {pending ? "Saving…" : judge ? "Save judge" : "Add judge"}
        </Button>
      </fieldset>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </form>
  )
}

export function JudgeRoster({
  eventId,
  judges,
  tracks,
}: {
  eventId: string
  judges: JudgeRosterEntry[]
  tracks: Track[]
}) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="judges-heading">
      <h2 id="judges-heading" className="text-xl font-semibold">
        Judges
      </h2>
      <p className="text-sm text-muted-foreground">
        Add emails before or after registration. Judges sign in with an email
        code on the participant portal at /judge; they do not need to apply as
        participants. Adding a judge sends no email and grants no admin access.
      </p>
      {judges.map((judge) => (
        <Card key={judge.id}>
          <CardContent>
            <EventJudgeForm eventId={eventId} judge={judge} tracks={tracks} />
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardContent>
          <EventJudgeForm
            key={`new-${eventId}`}
            eventId={eventId}
            tracks={tracks}
          />
        </CardContent>
      </Card>
    </section>
  )
}
