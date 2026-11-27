"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useId, useState, useTransition } from "react"

import {
  assignAward,
  deleteAward,
  saveAward,
  unassignAward,
} from "@/app/(admin)/awards/actions"
import {
  awardCandidates,
  MAX_AWARD_RANK,
  type AdminAward,
  type AwardCandidate,
} from "@/lib/awards"

export type AwardTrack = { id: string; name: string; active: boolean }

const GENERAL = "general"

function AwardForm({
  eventId,
  award,
  tracks,
}: {
  eventId: string
  award?: AdminAward
  tracks: AwardTrack[]
}) {
  const id = useId()
  const [name, setName] = useState(award?.name ?? "")
  const [rank, setRank] = useState(award?.rank ?? 1)
  const [trackId, setTrackId] = useState(award?.track_id ?? GENERAL)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const choices = tracks.filter(
    (track) => track.active || track.id === award?.track_id
  )

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        setMessage(null)
        startTransition(async () => {
          try {
            const result = await saveAward({
              eventId,
              awardId: award?.id,
              name,
              rank,
              trackId: trackId === GENERAL ? null : trackId,
            })
            setMessage(result.error ?? (award ? "Award saved" : "Award added"))
            if (!result.error && !award) {
              setName("")
              setRank(1)
              setTrackId(GENERAL)
            }
          } catch {
            setMessage("Could not save award. Try again.")
          }
        })
      }}
    >
      <h3 className="font-semibold">{award ? award.name : "Add award"}</h3>
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-name`}>Award name</Label>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-track`}>Track</Label>
            <Select
              value={trackId}
              onValueChange={setTrackId}
              disabled={pending}
            >
              <SelectTrigger id={`${id}-track`} className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL}>General (no track)</SelectItem>
                {choices.map((track) => (
                  <SelectItem key={track.id} value={track.id}>
                    {track.active ? track.name : `${track.name} (inactive)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-rank`}>Rank</Label>
            <Input
              id={`${id}-rank`}
              type="number"
              min={1}
              max={MAX_AWARD_RANK}
              value={rank}
              onChange={(event) => setRank(Number(event.target.value))}
              required
              className="max-w-24"
            />
          </div>
        </div>
        <Button type="submit" variant="outline" className="w-fit">
          {award ? "Save award" : "Add award"}
        </Button>
      </fieldset>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </form>
  )
}

function AwardWinners({
  eventId,
  award,
  projects,
}: {
  eventId: string
  award: AdminAward
  projects: AwardCandidate[]
}) {
  const id = useId()
  const candidates = awardCandidates(award, projects)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ error: string | null }>) {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (result.error) setMessage(result.error)
      } catch {
        setMessage("Could not update the award. Try again.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <h4 className="text-sm font-medium">Winners</h4>
      {award.projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No winners yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {award.projects.map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                {project.name || "Untitled project"}
                {project.status !== "submitted" && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({project.status}, hidden from the gallery)
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    unassignAward({
                      eventId,
                      awardId: award.id,
                      projectId: project.id,
                    })
                  )
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {award.track_id
            ? "No other submitted projects are entered in this track."
            : "No other submitted projects."}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-project`}>Add winner</Label>
            <Select
              value={projectId ?? ""}
              onValueChange={setProjectId}
              disabled={pending}
            >
              <SelectTrigger id={`${id}-project`} className="w-64">
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name || "Untitled project"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !projectId}
            onClick={() => {
              if (!projectId) return
              run(async () => {
                const result = await assignAward({
                  eventId,
                  awardId: award.id,
                  projectId,
                })
                if (!result.error) setProjectId(null)
                return result
              })
            }}
          >
            Add winner
          </Button>
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "Delete this award? Its winners lose the award in the gallery."
            )
          )
            return
          run(() => deleteAward(eventId, award.id))
        }}
      >
        Delete award
      </Button>
      {message && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
    </div>
  )
}

export function AwardsManager({
  eventId,
  awards,
  projects,
  tracks,
}: {
  eventId: string
  awards: AdminAward[]
  projects: AwardCandidate[]
  tracks: AwardTrack[]
}) {
  return (
    <div className="flex flex-col gap-4">
      {awards.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No awards for this event.
        </p>
      )}
      {awards.map((award) => (
        <Card key={award.id}>
          <CardContent className="flex flex-col gap-3">
            <AwardForm eventId={eventId} award={award} tracks={tracks} />
            <AwardWinners eventId={eventId} award={award} projects={projects} />
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardContent>
          <AwardForm key={`new-${eventId}`} eventId={eventId} tracks={tracks} />
        </CardContent>
      </Card>
    </div>
  )
}
