"use client"

import type { AdminProjectQuestion } from "@workspace/forms"
import { useTransition, useState } from "react"

import { setQuestionGallery } from "@/app/(admin)/submission-forms/actions"
import { galleryEligible, summaryEligible } from "@/lib/gallery"

export function QuestionGalleryControls({
  eventId,
  question,
}: {
  eventId: string
  question: AdminProjectQuestion
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!galleryEligible(question.type))
    return (
      <p className="text-sm text-muted-foreground">
        File answers are never shown in the public gallery.
      </p>
    )

  function save(value: { public: boolean; summary: boolean }) {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await setQuestionGallery({
          eventId,
          questionId: question.id,
          ...value,
        })
        if (result.error) setMessage(result.error)
      } catch {
        setMessage("Could not update gallery visibility. Try again.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={question.gallery_public}
            disabled={pending}
            onChange={(event) =>
              save({
                public: event.target.checked,
                summary: event.target.checked && question.gallery_summary,
              })
            }
          />
          Show in gallery
        </label>
        {summaryEligible(question.type) && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={question.gallery_summary}
              disabled={pending}
              onChange={(event) =>
                save({
                  public: question.gallery_public || event.target.checked,
                  summary: event.target.checked,
                })
              }
            />
            Gallery summary
          </label>
        )}
      </div>
      {message && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
    </div>
  )
}
