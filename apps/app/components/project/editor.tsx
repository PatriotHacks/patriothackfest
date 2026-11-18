"use client"

import {
  fileAnswer,
  type ProjectAnswer,
  type ProjectQuestion,
} from "@workspace/forms"
import { signedUrlOrThrow } from "@workspace/supabase/storage"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { ProjectAnswerView } from "@workspace/ui/components/project-answer"
import { RequiredMark } from "@workspace/ui/components/required-mark"
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react"

import { saveProject, submitProject } from "@/app/(projects)/projects/actions"
import {
  NAME_FIELD,
  projectValues,
  TRACKS_FIELD,
  type AutosaveState,
  type ProjectValues,
} from "@/lib/project-autosave"
import { projectFileUrl } from "@/lib/project-file-actions"
import { removeProjectFiles } from "@/lib/project-files"
import {
  normalizedProjectAnswers,
  projectAnswers,
  projectContentSchema,
  type ProjectDetail,
} from "@/lib/projects"
import { projectNavigationLeavesPage } from "@/lib/project-navigation"

import { ProjectAnswerInput } from "./answer-input"
import { useProjectTitle } from "./project-title"
import { useDraftAutosave } from "./use-draft-autosave"

const SUBMITTED_NOTICE =
  "Project submitted. You can save changes until submissions close."

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
  const [notice, setNotice] = useState<string | null>(null)
  if (!editable) return <ProjectReadOnly detail={detail} />
  return detail.project.status === "draft" ? (
    <DraftEditor
      detail={detail}
      onSubmitted={() => setNotice(SUBMITTED_NOTICE)}
    />
  ) : (
    <SubmittedEditor detail={detail} notice={notice} />
  )
}

function useUnsavedWarning(active: boolean) {
  useEffect(() => {
    if (!active) return
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
  }, [active])
}

function Field({
  field,
  remote,
  onFocusField,
  onBlurField,
  children,
}: {
  field: string
  remote?: ReadonlySet<string>
  onFocusField?: (field: string) => void
  onBlurField?: (field: string) => void
  children: ReactNode
}) {
  return (
    <div
      className="flex flex-col gap-1"
      onFocus={() => onFocusField?.(field)}
      onBlur={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          onBlurField?.(field)
      }}
    >
      {children}
      {remote?.has(field) && (
        <p className="text-xs text-[#6E6E68]">Updated by a teammate</p>
      )}
    </div>
  )
}

function ProjectFields({
  detail,
  values,
  errors,
  remote,
  onName,
  onAnswer,
  onTracks,
  onUploaded,
  onUploadingChange,
  onFocusField,
  onBlurField,
}: {
  detail: ProjectDetail
  values: ProjectValues
  errors: Record<string, string>
  remote?: ReadonlySet<string>
  onName: (name: string) => void
  onAnswer: (question: ProjectQuestion, value: ProjectAnswer) => void
  onTracks: (trackIds: string[]) => void
  onUploaded: (path: string) => void
  onUploadingChange: (uploading: boolean) => void
  onFocusField?: (field: string) => void
  onBlurField?: (field: string) => void
}) {
  const id = useId()
  const focus = { remote, onFocusField, onBlurField }
  const { trackIds } = values
  const unavailable = detail.selected_tracks.filter((track) => !track.active)
  return (
    <>
      <Field field={NAME_FIELD} {...focus}>
        <Label htmlFor={`${id}-name`}>
          Project name
          <RequiredMark />
        </Label>
        <Input
          id={`${id}-name`}
          maxLength={120}
          value={values.name}
          onChange={(event) => onName(event.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-required
          aria-describedby={errors.name ? `${id}-name-error` : undefined}
        />
        {errors.name && (
          <p id={`${id}-name-error`} className="text-sm text-red-700">
            {errors.name}
          </p>
        )}
      </Field>
      {detail.questions.map((question) => (
        <Field key={question.id} field={question.id} {...focus}>
          <ProjectAnswerInput
            id={id}
            projectId={detail.project.id}
            question={question}
            value={values.answers[question.id] ?? null}
            error={errors[`answers.${question.id}`]}
            onChange={(value) => onAnswer(question, value)}
            onUploaded={onUploaded}
            onUploadingChange={onUploadingChange}
          />
        </Field>
      ))}
      <Field field={TRACKS_FIELD} {...focus}>
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
                  onTracks(
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
                  onTracks(trackIds.filter((selected) => selected !== track.id))
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
      </Field>
    </>
  )
}

const SAVE_LABELS: Record<AutosaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  retrying: "Couldn't save — retrying",
  error: "Couldn't save",
  stopped: "Not saving",
}

function DraftEditor({
  detail,
  onSubmitted,
}: {
  detail: ProjectDetail
  onSubmitted: () => void
}) {
  const draft = useDraftAutosave(detail)
  const [uploading, setUploading] = useState(0)
  const [submitting, startSubmit] = useTransition()
  useUnsavedWarning(draft.pending || uploading > 0)

  function submit() {
    draft.setMessage(null)
    startSubmit(async () => {
      if (!(await draft.flush())) {
        if (!draft.stopped())
          draft.setMessage(
            "Some changes are not saved yet. Fix any highlighted fields or check your connection, then submit again."
          )
        return
      }
      try {
        const result = await submitProject({
          projectId: detail.project.id,
          updatedAt: draft.base(),
        })
        if (!result.error) return onSubmitted()
        if (result.stale) {
          await draft.refresh()
          if (!draft.stopped())
            draft.setMessage(
              "A teammate just saved changes. Review them, then submit again."
            )
          return
        }
        draft.setErrors(result.fieldErrors ?? {})
        draft.setMessage(result.error)
      } catch {
        draft.setMessage("Could not submit your project. Try again.")
      }
    })
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">Project details</h2>
        <p role="status" aria-live="polite" className="text-sm text-[#6E6E68]">
          {SAVE_LABELS[draft.state]}
        </p>
      </div>
      <p className="text-sm text-[#6E6E68]">
        Changes save automatically and teammates see them within a few seconds.
        Submit once you have a project name and every required answer. Make any
        links accessible to judges.
      </p>
      <fieldset disabled={submitting} className="flex flex-col gap-4">
        <ProjectFields
          detail={detail}
          values={draft.values}
          errors={draft.errors}
          remote={draft.remote}
          onName={draft.editName}
          onAnswer={draft.editAnswer}
          onTracks={draft.editTracks}
          onUploaded={draft.uploaded}
          onUploadingChange={(active) =>
            setUploading((count) => count + (active ? 1 : -1))
          }
          onFocusField={draft.focus}
          onBlurField={draft.blur}
        />
        <Button
          type="submit"
          className="self-start"
          disabled={uploading > 0 || draft.state === "stopped"}
        >
          {submitting ? "Submitting…" : "Submit project"}
        </Button>
      </fieldset>
      {draft.errors.form && (
        <p role="alert" className="text-sm text-red-700">
          {draft.errors.form}
        </p>
      )}
      {draft.message && (
        <p role="alert" className="text-sm">
          {draft.message}
        </p>
      )}
      {draft.state === "stopped" && (
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

function SubmittedEditor({
  detail,
  notice,
}: {
  detail: ProjectDetail
  notice: string | null
}) {
  const [values, setValues] = useState(() => projectValues(detail))
  const [updatedAt, setUpdatedAt] = useState(detail.project.updated_at)
  const [saved, setSaved] = useState(() =>
    JSON.stringify(projectValues(detail))
  )
  const [message, setMessage] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(0)
  const unsavedUploads = useRef(new Set<string>())
  const [pending, startTransition] = useTransition()
  const setTitle = useProjectTitle()
  const dirty = saved !== JSON.stringify(values)
  useUnsavedWarning(dirty || uploading > 0)

  function save() {
    setMessage(null)
    setErrors({})
    startTransition(async () => {
      try {
        const result = await saveProject({
          projectId: detail.project.id,
          eventId: detail.project.event_id,
          content: { name: values.name },
          answers: values.answers,
          trackIds: values.trackIds,
          updatedAt,
        })
        if (result.error) {
          setMessage(result.error)
          setErrors(result.fieldErrors ?? {})
          setStale(Boolean(result.stale))
          return
        }
        setStale(false)
        const normalized: ProjectValues = {
          name: projectContentSchema.parse({ name: values.name }).name,
          answers: normalizedProjectAnswers(values.answers),
          trackIds: values.trackIds,
        }
        unsavedUploads.current.clear()
        setTitle?.(normalized.name)
        setValues(normalized)
        setSaved(JSON.stringify(normalized))
        if (result.updatedAt) setUpdatedAt(result.updatedAt)
        setMessage("Changes saved")
      } catch {
        setMessage(
          "Could not save your project. Your unsaved fields are still here; try again."
        )
      }
    })
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <h2 className="text-xl font-semibold">Edit submitted project</h2>
      <p className="text-sm text-[#6E6E68]">
        Keep a project name and every required answer. Make any links accessible
        to judges.
      </p>
      <fieldset disabled={pending} className="flex flex-col gap-4">
        <ProjectFields
          detail={detail}
          values={values}
          errors={errors}
          onName={(name) => setValues((current) => ({ ...current, name }))}
          onAnswer={(question, value) => {
            const previous = fileAnswer(values.answers[question.id])?.path
            if (
              previous &&
              previous !== fileAnswer(value)?.path &&
              unsavedUploads.current.delete(previous)
            )
              void removeProjectFiles([previous])
            setValues((current) => ({
              ...current,
              answers: { ...current.answers, [question.id]: value },
            }))
          }}
          onTracks={(trackIds) =>
            setValues((current) => ({ ...current, trackIds }))
          }
          onUploaded={(path) => unsavedUploads.current.add(path)}
          onUploadingChange={(active) =>
            setUploading((count) => count + (active ? 1 : -1))
          }
        />
        <Button
          type="submit"
          variant="outline"
          className="self-start"
          disabled={uploading > 0}
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </fieldset>
      {errors.form && (
        <p role="alert" className="text-sm text-red-700">
          {errors.form}
        </p>
      )}
      <p className="text-sm text-[#6E6E68]">
        {dirty
          ? "Unsaved changes — save before leaving this page."
          : "Submitted"}
      </p>
      <p role="status" aria-live="polite" className="text-sm">
        {message ?? notice}
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
