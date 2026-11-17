"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useId, useState, useTransition } from "react"

import {
  setJudgesSeeTeam,
  setMaxTeamSize,
} from "@/app/(admin)/submission-forms/actions"

export function TeamSettings({
  eventId,
  maxTeamSize,
  judgesSeeTeam,
}: {
  eventId: string
  maxTeamSize: number | null
  judgesSeeTeam: boolean
}) {
  const id = useId()
  const [size, setSize] = useState(maxTeamSize?.toString() ?? "")
  const [checked, setChecked] = useState(judgesSeeTeam)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const value = size.trim() === "" ? null : Number(size)
          setMessage(null)
          startTransition(async () => {
            try {
              const result = await setMaxTeamSize(eventId, value)
              setMessage(
                result.error ??
                  (value === null
                    ? "Teams have no size limit"
                    : `Teams are limited to ${value} ${value === 1 ? "member" : "members"}`)
              )
            } catch {
              setMessage("Could not update the team size limit. Try again.")
            }
          })
        }}
      >
        <Label htmlFor={`${id}-size`}>Maximum team size</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={`${id}-size`}
            type="number"
            min={1}
            step={1}
            value={size}
            onChange={(event) => setSize(event.target.value)}
            disabled={pending}
            className="w-32"
          />
          <Button type="submit" variant="outline" disabled={pending}>
            Save limit
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Counts the project owner. Leave blank for no limit. A limit cannot be
          set below the size of an existing team.
        </p>
      </form>
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
                  const result = await setJudgesSeeTeam(eventId, value)
                  if (result.error) {
                    setMessage(result.error)
                    return
                  }
                  setChecked(value)
                  setMessage(
                    value
                      ? "Judges can now see team member names"
                      : "Team member names are hidden from judges"
                  )
                } catch {
                  setMessage("Could not update judge visibility. Try again.")
                }
              })
            }}
          />
          Judges can see team member names
        </label>
        <p className="text-sm text-muted-foreground">
          Names only, never emails. Can be changed at any time, including during
          judging. Organizers always see teams.
        </p>
      </div>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </div>
  )
}
