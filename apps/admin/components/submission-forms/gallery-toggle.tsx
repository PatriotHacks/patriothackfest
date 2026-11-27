"use client"

import { useState, useTransition } from "react"

import { setGalleryPublished } from "@/app/(admin)/submission-forms/actions"

export function GalleryPublishToggle({
  eventId,
  published,
}: {
  eventId: string
  published: boolean
}) {
  const [checked, setChecked] = useState(published)
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
                const result = await setGalleryPublished(eventId, value)
                if (result.error) {
                  setMessage(result.error)
                  return
                }
                setChecked(value)
                setMessage(
                  value
                    ? "The gallery is now public"
                    : "The gallery is no longer public"
                )
              } catch {
                setMessage("Could not update the gallery. Try again.")
              }
            })
          }}
        />
        Publish the project gallery
      </label>
      <p className="text-sm text-muted-foreground">
        Anyone can then browse submitted projects for this event: names, team
        member names, tracks, awards, and answers to questions marked Show in
        gallery. Drafts and withdrawn projects are never shown.
      </p>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </div>
  )
}
