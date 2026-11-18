"use client"

import { fileAnswer } from "@workspace/forms"
import { signedUrlOrThrow } from "@workspace/supabase/storage"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { ProjectAnswerView } from "@workspace/ui/components/project-answer"
import { RequiredMark } from "@workspace/ui/components/required-mark"
import { useEffect, useId, useRef, useState, useTransition } from "react"

import { saveProject } from "@/app/(projects)/projects/actions"
import { projectFileUrl } from "@/lib/project-file-actions"
import { removeProjectFiles } from "@/lib/project-files"
import {
  normalizedProjectAnswers,
  projectAnswers,
  projectContent,
  projectContentSchema,
  type ProjectAnswers,
  type ProjectDetail,
} from "@/lib/projects"
import { projectNavigationLeavesPage } from "@/lib/project-navigation"

import { ProjectAnswerInput } from "./answer-input"

export function ProjectReadOnly({ detail }: { detail: ProjectDetail }) {
  const answers = projectAnswers(detail)
  return (
    <section className="flex flex-col gap-3" aria-label="Project details">
      <h2 className="text-xl font-semibold">Project details</h2>
      {detail.questions.map((question) => (
        <div key={question.id} className="flex flex-col gap-1">
          <h3 className="font-semibold">{question.label}</h3>
          <ProjectAnswerView
            item={{
              type: question.type,
              options: question.options,
              answer: answers[question.id] ?? null,
            }}
            sign={(file) => signedUrlOrThrow(projectFileUrl(file.path))}
          />
        </div>
      ))}
      <p className="text-sm">
        <strong>Sponsor tracks:</strong>{" "}
        {detail.selected_tracks.map((track) => track.name).join(", ") || "None"}
        . All submitted projects enter general judging.
      </p>
    </section>
  )
}

export function ProjectEditor({
  detail,
  editable,
}: {
  detail: ProjectDetail
  editable: boolean
}) {
  const id = useId()
  const [content, setContent] = useState(() => projectContent(detail))
  const [answers, setAnswers] = useState(() => projectAnswers(detail))
  const [trackIds, setTrackIds] = useState(() =>
    detail.selected_tracks.map((track) => track.id)
  )
  const [updatedAt, setUpdatedAt] = useState(detail.project.updated_at)
  const [status, setStatus] = useState(detail.project.status)
  const [saved, setSaved] = useState(() =>
    JSON.stringify({
      content: projectContent(detail),
      answers: projectAnswers(detail),
      trackIds: detail.selected_tracks.map((track) => track.id),
    })
  )
  const [message, setMessage] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(0)
  const unsavedUploads = useRef(new Set<string>())
  const [pending, startTransition] = useTransition()
  const dirty = saved !== JSON.stringify({ content, answers, trackIds })

  useEffect(() => {
    if (!dirty || !editable) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    const confirmLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const link =
        event.target instanceof Element ? event.target.closest("a[href]") : null
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return
      if (
        projectNavigationLeavesPage(link.href, window.location.href) &&
        !window.confirm(
          "You have unsaved project changes. Leave without saving?"
        )
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    document.addEventListener("click", confirmLink, true)
    return () => {
      window.removeEventListener("beforeunload", warn)
      document.removeEventListener("click", confirmLink, true)
    }
  }, [dirty, editable])

  if (!editable) return <ProjectReadOnly detail={detail} />

  function save(submit: boolean) {
    setMessage(null)
    setErrors({})
    startTransition(async () => {
      try {
        const result = await saveProject({
          projectId: detail.project.id,
          eventId: detail.project.event_id,
          content,
          answers,
          trackIds,
          submit,
          updatedAt,
        })
        if (result.error) {
          setMessage(result.error)
          setErrors(result.fieldErrors ?? {})
          setStale(Boolean(result.stale))
          return
        }
        setStale(false)
        const normalized = projectContentSchema.parse(content)
        const normalizedAnswers = normalizedProjectAnswers(answers)
        unsavedUploads.current.clear()
        setContent(normalized)
        setAnswers(normalizedAnswers)
        setSaved(
          JSON.stringify({
            content: normalized,
            answers: normalizedAnswers,
            trackIds,
          })
        )
        if (result.updatedAt) setUpdatedAt(result.updatedAt)
        if (submit) setStatus("submitted")
        setMessage(
          submit
            ? "Project submitted. You can save changes until submissions close."
            : "Changes saved"
        )
      } catch {
        setMessage(
          "Could not save your project. Your unsaved fields are still here; try again."
        )
      }
    })
  }

  const unavailable = detail.selected_tracks.filter((track) => !track.active)
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        save(false)
      }}
    >
      <h2 className="text-xl font-semibold">
        {status === "submitted" ? "Edit submitted project" : "Project details"}
      </h2>
      <p className="text-sm text-[#6E6E68]">
        Submit a project name and answer every required question. Make any links
        accessible to judges.
      </p>
      <fieldset disabled={pending} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-name`}>
            Project name
            <RequiredMark />
          </Label>
          <Input
            id={`${id}-name`}
            maxLength={120}
            value={content.name}
            onChange={(event) => setContent({ name: event.target.value })}
            aria-invalid={Boolean(errors.name)}
            aria-required
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
          />
          {errors.name && (
            <p id={`${id}-name-error`} className="text-sm text-red-700">
              {errors.name}
            </p>
          )}
        </div>
        {detail.questions.map((question) => (
          <ProjectAnswerInput
            key={question.id}
            id={id}
            projectId={detail.project.id}
            question={question}
            value={answers[question.id] ?? null}
            error={errors[`answers.${question.id}`]}
            onChange={(value) => {
              const previous = fileAnswer(answers[question.id])?.path
              if (
                previous &&
                previous !== fileAnswer(value)?.path &&
                unsavedUploads.current.delete(previous)
              )
                void removeProjectFiles([previous])
              setAnswers((current) => ({ ...current, [question.id]: value }))
            }}
            onUploaded={(path) => unsavedUploads.current.add(path)}
            onUploadingChange={(active) =>
              setUploading((count) => count + (active ? 1 : -1))
            }
          />
        ))}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">
            Sponsor tracks (optional)
          </legend>
          <p className="text-sm text-[#6E6E68]">
            Select any that apply. All submitted projects enter general judging,
            even if none are selected.
          </p>
          {detail.available_tracks.map((track) => (
            <label key={track.id} className="flex items-start gap-2">
              <input
                className="mt-1"
                type="checkbox"
                checked={trackIds.includes(track.id)}
                onChange={(event) =>
                  setTrackIds(
                    event.target.checked
                      ? [...trackIds, track.id]
                      : trackIds.filter((selected) => selected !== track.id)
                  )
                }
              />
              <span>
                {track.name}
                {track.sponsor ? ` · ${track.sponsor}` : ""}
                {track.description && (
                  <span className="block text-sm text-[#6E6E68]">
                    {track.description}
                  </span>
                )}
              </span>
            </label>
          ))}
          {unavailable.map((track) => (
            <label key={track.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={trackIds.includes(track.id)}
                disabled={!trackIds.includes(track.id)}
                onChange={() =>
                  setTrackIds(
                    trackIds.filter((selected) => selected !== track.id)
                  )
                }
              />
              {track.name} — unavailable; remove before saving
            </label>
          ))}
          {errors.track_ids && (
            <p role="alert" className="text-sm text-red-700">
              {errors.track_ids}
            </p>
          )}
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="outline" disabled={uploading > 0}>
            {pending
              ? "Saving…"
              : status === "submitted"
                ? "Save changes"
                : "Save draft"}
          </Button>
          {status === "draft" && (
            <Button
              type="button"
              disabled={uploading > 0}
              onClick={() => save(true)}
            >
              Submit project
            </Button>
          )}
        </div>
      </fieldset>
      {errors.form && (
        <p role="alert" className="text-sm text-red-700">
          {errors.form}
        </p>
      )}
      <p className="text-sm text-[#6E6E68]">
        {dirty
          ? "Unsaved changes — save before leaving this page."
          : status === "submitted"
            ? "Submitted"
            : "Draft saved"}
      </p>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
      {stale && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => window.location.reload()}
        >
          Reload page
        </Button>
      )}
    </form>
  )
}
