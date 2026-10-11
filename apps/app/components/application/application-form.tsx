"use client"

import {
  fileAnswerSchema,
  isFieldVisible,
  validateAnswers,
  type AnswerErrors,
  type Answers,
  type Field,
  type PublishedSchema,
} from "@workspace/forms"
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  getUpdatedAt,
  saveAnswers,
  submitApplication,
} from "@/app/(applicant)/applications/[id]/actions"
import { removeFiles } from "@/lib/application-files"

import {
  fieldContainerId,
  fieldErrorId,
  fieldInputId,
  fieldLabelId,
} from "./field-ids"
import { FieldInput } from "./field-input"
import { FileField } from "./file-field"
import { SaveIndicator } from "./save-indicator"
import { useDraftAutosave } from "./use-draft-autosave"

type Props = {
  mode: "draft" | "edit"
  applicationId: string
  userId: string
  schema: PublishedSchema
  initialAnswers: Answers
  updatedAt: string
  editNote: string | null
}

function filePath(value: unknown) {
  const parsed = fileAnswerSchema.safeParse(value)
  return parsed.success ? parsed.data.path : null
}

function firstErrorField(fields: Field[], errors: AnswerErrors) {
  return fields.find((f) => errors[f.id])
}

function focusField(field: Field) {
  document
    .getElementById(fieldContainerId(field.id))
    ?.scrollIntoView({ behavior: "smooth", block: "center" })
  const input = document.getElementById(fieldInputId(field.id))
  const target =
    input?.querySelector<HTMLElement>("button, input") ?? input ?? null
  target?.focus({ preventScroll: true })
}

export function ApplicationForm({
  mode,
  applicationId,
  userId,
  schema,
  initialAnswers,
  updatedAt,
  editNote,
}: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState(initialAnswers)
  const answersRef = useRef(initialAnswers)
  const lastKnown = useRef(updatedAt)
  const pendingDeletes = useRef(new Set<string>())
  const [errors, setErrors] = useState<AnswerErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(0)

  const visible = schema.fields.filter((f) =>
    isFieldVisible(f, answers, schema)
  )

  const persist = useCallback(
    async (snapshot: Answers) => {
      const result = await saveAnswers(applicationId, snapshot)
      if (result.error) return result
      lastKnown.current = result.updatedAt!
      const referenced = new Set(Object.values(snapshot).map(filePath))
      const removable = [...pendingDeletes.current].filter(
        (path) => !referenced.has(path)
      )
      removable.forEach((path) => pendingDeletes.current.delete(path))
      void removeFiles(removable)
      return result
    },
    [applicationId]
  )

  const autosave = useDraftAutosave(persist)
  const savingRef = useRef(false)
  useEffect(() => {
    savingRef.current = busy || autosave.status === "saving"
  }, [busy, autosave.status])

  useEffect(() => {
    async function check() {
      if (savingRef.current) return
      const result = await getUpdatedAt(applicationId)
      if (result.updatedAt && result.updatedAt !== lastKnown.current)
        setStale(true)
    }
    window.addEventListener("focus", check)
    return () => window.removeEventListener("focus", check)
  }, [applicationId])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  function update(field: Field, value: unknown) {
    const previous = filePath(answersRef.current[field.id])
    if (previous && previous !== filePath(value))
      pendingDeletes.current.add(previous)

    const next = { ...answersRef.current }
    if (value === undefined) delete next[field.id]
    else next[field.id] = value
    answersRef.current = next
    setAnswers(next)
    setMessage(null)
    if (errors[field.id]) {
      const rest = { ...errors }
      delete rest[field.id]
      setErrors(rest)
    }

    if (mode === "edit") {
      setDirty(true)
      return
    }
    autosave.schedule(next)
    if (field.type === "file") void autosave.flush()
  }

  function showErrors(next: AnswerErrors) {
    setErrors(next)
    const first = firstErrorField(visible, next)
    if (first) requestAnimationFrame(() => focusField(first))
    setFormError(
      first ? "Some answers need attention" : Object.values(next).join(". ")
    )
  }

  async function submit() {
    setBusy(true)
    setFormError(null)
    try {
      if (!(await autosave.flush())) {
        setFormError("Your answers could not be saved. Try again.")
        return
      }
      const local = validateAnswers(schema, answersRef.current, {
        mode: "submit",
      })
      if (Object.keys(local).length > 0) return showErrors(local)
      const result = await submitApplication(applicationId)
      if (result.fieldErrors) return showErrors(result.fieldErrors)
      if (result.error) setFormError(result.error)
    } finally {
      setBusy(false)
    }
  }

  async function saveChanges() {
    setFormError(null)
    setMessage(null)
    const snapshot = answersRef.current
    const local = validateAnswers(schema, snapshot, { mode: "submit" })
    if (Object.keys(local).length > 0) return showErrors(local)
    setBusy(true)
    try {
      const result = await persist(snapshot)
      if (result.fieldErrors) return showErrors(result.fieldErrors)
      if (result.error) return setFormError(result.error)
      if (answersRef.current === snapshot) setDirty(false)
      setMessage("Changes saved")
    } finally {
      setBusy(false)
    }
  }

  function reload() {
    autosave.cancel()
    setDirty(false)
    setStale(false)
    router.refresh()
  }

  const locked = busy || uploading > 0

  return (
    <div className="flex flex-col gap-6">
      {stale && (
        <Alert>
          <AlertDescription>
            This application was updated in another tab. Reload to see the
            latest answers; saving here overwrites them.
          </AlertDescription>
          <AlertAction className="flex gap-2">
            <Button size="sm" onClick={reload}>
              Reload
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStale(false)}>
              Dismiss
            </Button>
          </AlertAction>
        </Alert>
      )}

      {visible.map((field) => {
        const error = errors[field.id]
        return (
          <div
            key={field.id}
            id={fieldContainerId(field.id)}
            className="flex flex-col gap-1.5"
          >
            <Label id={fieldLabelId(field.id)} htmlFor={fieldInputId(field.id)}>
              {field.label}
              {field.required && (
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              )}
              {field.required && <span className="sr-only">(required)</span>}
            </Label>
            {field.help_text && (
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {field.help_text}
              </p>
            )}
            {field.type === "file" ? (
              <FileField
                field={field}
                value={answers[field.id]}
                invalid={error !== undefined}
                disabled={busy}
                userId={userId}
                applicationId={applicationId}
                onChange={(value) => update(field, value)}
                onUploadingChange={(active) =>
                  setUploading((n) => n + (active ? 1 : -1))
                }
              />
            ) : (
              <FieldInput
                field={field}
                value={answers[field.id]}
                invalid={error !== undefined}
                disabled={busy}
                onChange={(value) => update(field, value)}
                onBlur={() => {
                  if (mode === "draft") void autosave.flush()
                }}
              />
            )}
            {error && (
              <p
                id={fieldErrorId(field.id)}
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </div>
        )
      })}

      <div className="flex flex-col gap-2 border-t pt-4">
        <div className="flex flex-wrap items-center gap-3">
          {mode === "draft" ? (
            <>
              <Button onClick={submit} disabled={locked}>
                Submit application
              </Button>
              <SaveIndicator status={autosave.status} error={autosave.error} />
            </>
          ) : (
            <>
              <Button onClick={saveChanges} disabled={locked || !dirty}>
                Save changes
              </Button>
              {dirty && (
                <span className="text-sm text-muted-foreground">
                  Unsaved changes
                </span>
              )}
              {message && (
                <span role="status" className="text-sm text-muted-foreground">
                  {message}
                </span>
              )}
            </>
          )}
        </div>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        {editNote && (
          <p className="text-sm text-muted-foreground">{editNote}</p>
        )}
      </div>
    </div>
  )
}
