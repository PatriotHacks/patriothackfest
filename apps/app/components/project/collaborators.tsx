"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useId, useState, useTransition } from "react"

import {
  addProjectCollaborator,
  removeProjectCollaborator,
} from "@/app/(projects)/projects/actions"
import type { ProjectDetail } from "@/lib/projects"

export function ProjectCollaborators({
  detail,
  editable,
}: {
  detail: ProjectDetail
  editable: boolean
}) {
  const id = useId()
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-xl font-semibold">
        Collaborators
      </h2>
      <p className="text-sm text-[#6E6E68]">
        The project owner submits and edits. Collaborators can view the project.
        Teams are formed outside the portal.
      </p>
      <ul className="flex flex-col gap-2">
        {detail.collaborators.map((person) => (
          <li
            key={person.user_id}
            className="flex items-center justify-between gap-3"
          >
            <span>
              {person.full_name || `Participant ${person.user_id.slice(-6)}`}
            </span>
            {editable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                aria-label={`Remove ${person.full_name || "collaborator"}`}
                onClick={() => {
                  setMessage(null)
                  startTransition(async () => {
                    try {
                      const result = await removeProjectCollaborator(
                        detail.project.id,
                        person.user_id
                      )
                      setMessage(result.error ?? "Collaborator removed")
                    } catch {
                      setMessage("Could not remove collaborator. Try again.")
                    }
                  })
                }}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      {detail.collaborators.length === 0 && (
        <p className="text-sm">
          No additional collaborators. Solo projects are welcome.
        </p>
      )}
      {editable && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setMessage(null)
            startTransition(async () => {
              try {
                const result = await addProjectCollaborator(
                  detail.project.id,
                  email
                )
                setMessage(result.error ?? "Collaborator added")
                if (!result.error) setEmail("")
              } catch {
                setMessage("Could not add collaborator. Try again.")
              }
            })
          }}
        >
          <Label htmlFor={`${id}-email`}>Registered collaborator's email</Label>
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
              Add collaborator
            </Button>
          </div>
          <p className="text-sm text-[#6E6E68]">
            They must have submitted an application and been accepted for this
            event. Use the address they registered with.
          </p>
        </form>
      )}
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </section>
  )
}
