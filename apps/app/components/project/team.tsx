"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useId, useState, useTransition } from "react"

import {
  addProjectCollaborator,
  leaveProject,
  removeProjectCollaborator,
  type ProjectResult,
} from "@/app/(projects)/projects/actions"
import { memberName, teamMembers, type ProjectDetail } from "@/lib/projects"

export function ProjectTeam({
  detail,
  userId,
  editable,
  eventHref,
}: {
  detail: ProjectDetail
  userId: string
  editable: boolean
  eventHref: string
}) {
  const id = useId()
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [pending, startTransition] = useTransition()
  const members = teamMembers(detail)
  const isOwner = detail.owner.user_id === userId
  const max = detail.max_team_size
  const full = max !== null && members.length >= max

  function run(
    action: () => Promise<ProjectResult>,
    success: string,
    failure: string,
    done?: () => void
  ) {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (result.error) {
          setMessage(result.error)
          return
        }
        setMessage(success)
        done?.()
      } catch {
        setMessage(failure)
      }
    })
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-heading`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-heading`} className="text-xl font-semibold">
          Team
        </h2>
        {max !== null && (
          <p className="text-sm text-[#6E6E68]">
            {members.length} / {max} members
          </p>
        )}
      </div>
      <p className="text-sm text-[#6E6E68]">
        Everyone on the team can edit and submit this project. You can only be
        on one team per event.
      </p>
      <ul className="flex flex-col gap-2">
        {members.map((member) => (
          <li
            key={member.user_id}
            className="flex items-center justify-between gap-3"
          >
            <span>
              {memberName(member.full_name)}
              {member.owner && (
                <span className="text-sm text-[#6E6E68]"> · Owner</span>
              )}
              {member.user_id === userId && (
                <span className="text-sm text-[#6E6E68]"> · You</span>
              )}
            </span>
            {editable && isOwner && !member.owner && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                aria-label={`Remove ${memberName(member.full_name)}`}
                onClick={() =>
                  run(
                    () =>
                      removeProjectCollaborator(
                        detail.project.id,
                        member.user_id
                      ),
                    "Teammate removed",
                    "Could not remove teammate. Try again."
                  )
                }
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      {editable &&
        (full ? (
          <p className="text-sm">This team is full.</p>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              run(
                () => addProjectCollaborator(detail.project.id, email),
                "Teammate added",
                "Could not add teammate. Try again.",
                () => setEmail("")
              )
            }}
          >
            <Label htmlFor={`${id}-email`}>Add a teammate by email</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={`${id}-email`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={pending}
                required
                className="min-w-48 flex-1"
                autoComplete="off"
              />
              <Button type="submit" variant="outline" disabled={pending}>
                Add teammate
              </Button>
            </div>
            <p className="text-sm text-[#6E6E68]">
              They are added right away. They must have been accepted for this
              event; use the address they registered with.
            </p>
          </form>
        ))}
      {editable &&
        !isOwner &&
        (confirmLeave ? (
          <div className="flex flex-col gap-2" role="group">
            <p className="text-sm">
              Leave this team? You will lose access to this project.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  run(
                    () => leaveProject(detail.project.id),
                    "You left the team",
                    "Could not leave the team. Try again.",
                    () => window.location.assign(eventHref)
                  )
                }
              >
                Leave team
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirmLeave(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={pending}
            onClick={() => {
              setMessage(null)
              setConfirmLeave(true)
            }}
          >
            Leave team
          </Button>
        ))}
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </section>
  )
}
