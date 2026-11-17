"use client"

import { fileAnswer } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
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
  type ProjectContent,
  type ProjectDetail,
} from "@/lib/projects"
import { projectNavigationLeavesPage } from "@/lib/project-navigation"

import { ProjectAnswerInput } from "./answer-input"
import { ProjectAnswerView, signedUrlOrThrow } from "./answer-view"

function filePaths(answers: ProjectAnswers) {
  return Object.values(answers)
    .map((value) => fileAnswer(value)?.path)
    .filter((path) => path !== undefined)
}

const fields: {
  key: keyof ProjectContent
  label: string
  max: number
  multiline?: boolean
}[] = [
  { key: "name", label: "Project name", max: 120 },
  { key: "summary", label: "Short summary", max: 300 },
  {
    key: "description",
    label: "Description — what does it do and how does it work?",
    max: 10_000,
    multiline: true,
  },
  { key: "technologies", label: "Technologies (optional)", max: 1000 },
  { key: "repository_url", label: "Repository/source URL", max: 2048 },
  { key: "demo_url", label: "Demo URL", max: 2048 },
  { key: "video_url", label: "Video URL", max: 2048 },
]

function validLink(value: string) {
  const parsed = projectContentSchema.safeParse({ demo_url: value })
  return parsed.success && Boolean(parsed.data.demo_url)
}

export function ProjectReadOnly({ detail }: { detail: ProjectDetail }) {
  const answers = projectAnswers(detail)
  return (
    <section className="flex flex-col gap-3" aria-label="Project details">
      <h2 className="text-xl font-semibold">Project details</h2>
      <p>{detail.project.summary || "No project content saved yet."}</p>
      <p className="break-words whitespace-pre-wrap">
        {detail.project.description}
      </p>
      {detail.project.technologies && (
        <p>
          <strong>Technologies:</strong> {detail.project.technologies}
        </p>
      )}
      <ul className="flex flex-wrap gap-4">
        {(["repository_url", "demo_url", "video_url"] as const).map((key) => {
          const url = detail.project[key]
          return url && validLink(url) ? (
            <li key={key}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {key === "repository_url"
                  ? "Repository"
                  : key === "demo_url"
                    ? "Demo"
                    : "Video"}
              </a>
            </li>
          ) : null
        })}
      </ul>
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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(0)
  const savedAnswers = useRef(projectAnswers(detail))
  const uploaded = useRef(new Set<string>())
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
          content,
          answers,
          trackIds,
          submit,
          updatedAt,
        })
        if (result.error) {
          setMessage(result.error)
          setErrors(result.fieldErrors ?? {})
          return
        }
        const normalized = projectContentSchema.parse(content)
        const normalizedAnswers = normalizedProjectAnswers(answers)
        const kept = new Set(filePaths(normalizedAnswers))
        void removeProjectFiles(
          [
            ...new Set([
              ...filePaths(savedAnswers.current),
              ...uploaded.current,
            ]),
          ].filter((path) => !kept.has(path))
        )
        savedAnswers.current = normalizedAnswers
        uploaded.current = new Set()
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
        Submit a name, summary, description, and at least one repository, demo,
        or video URL. Make links accessible to judges. No deployed app required.
      </p>
      <fieldset disabled={pending} className="flex flex-col gap-4">
        {fields.map(({ key, label, max, multiline }) => (
          <div key={key} className="flex flex-col gap-1">
            <Label htmlFor={`${id}-${key}`}>{label}</Label>
            {multiline ? (
              <Textarea
                id={`${id}-${key}`}
                rows={6}
                maxLength={max}
                value={content[key]}
                onChange={(event) =>
                  setContent({ ...content, [key]: event.target.value })
                }
                aria-invalid={Boolean(errors[key])}
                aria-describedby={
                  errors[key] ? `${id}-${key}-error` : undefined
                }
              />
            ) : (
              <Input
                id={`${id}-${key}`}
                maxLength={max}
                type={key.endsWith("_url") ? "url" : "text"}
                value={content[key]}
                onChange={(event) =>
                  setContent({ ...content, [key]: event.target.value })
                }
                aria-invalid={Boolean(errors[key])}
                aria-describedby={
                  errors[key] ? `${id}-${key}-error` : undefined
                }
              />
            )}
            {errors[key] && (
              <p id={`${id}-${key}-error`} className="text-sm text-red-700">
                {errors[key]}
              </p>
            )}
          </div>
        ))}
        {detail.questions.map((question) => (
          <ProjectAnswerInput
            key={question.id}
            id={id}
            projectId={detail.project.id}
            question={question}
            value={answers[question.id] ?? null}
            error={errors[`answers.${question.id}`]}
            onChange={(value) =>
              setAnswers((current) => ({ ...current, [question.id]: value }))
            }
            onUploaded={(path) => uploaded.current.add(path)}
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
    </form>
  )
}
