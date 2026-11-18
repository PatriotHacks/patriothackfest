"use client"

import {
  editableProjectAnswer,
  fileAnswer,
  type ProjectAnswer,
  type ProjectQuestion,
} from "@workspace/forms"
import { useEffect, useEffectEvent, useRef, useState } from "react"

import {
  patchProject,
  type ProjectPatchResult,
} from "@/app/(projects)/projects/actions"
import {
  createAutosave,
  fieldErrorKey,
  mergeRemote,
  NAME_FIELD,
  POLL_INTERVAL_MS,
  projectPatch,
  projectValues,
  savesImmediately,
  TRACKS_FIELD,
  withFields,
  type AutosaveState,
  type ProjectValues,
  type SaveOutcome,
} from "@/lib/project-autosave"
import { removeProjectFiles } from "@/lib/project-files"
import { projectDetailSchema, type ProjectDetail } from "@/lib/projects"
import { browserClient } from "@/lib/storage-files"

import { useProjectTitle } from "./project-title"

const NO_ACCESS = "You no longer have access to this project. Reload the page."
const SUBMITTED =
  "A teammate submitted this project. Copy any unsaved text, then reload the page to keep editing."

function without<T>(record: Record<string, T>, keys: string[]) {
  const next = { ...record }
  for (const key of keys) delete next[key]
  return next
}

export function useDraftAutosave(detail: ProjectDetail) {
  const projectId = detail.project.id
  const eventId = detail.project.event_id
  const [values, setValues] = useState(() => projectValues(detail))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [remote, setRemote] = useState<ReadonlySet<string>>(() => new Set())
  const [state, setState] = useState<AutosaveState>("saved")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const setTitle = useProjectTitle()
  const current = useRef(values)
  const known = useRef(values)
  const base = useRef(detail.project.updated_at)
  const seen = useRef(detail.project.updated_at)
  const saves = useRef(0)
  const polling = useRef(false)
  const stopped = useRef(false)
  const deferred = useRef(new Set<string>())
  const unsavedUploads = useRef(new Set<string>())
  const [autosave] = useState(() =>
    createAutosave({
      send,
      onState: (next) => {
        stopped.current = next === "stopped"
        setState(next)
        setPending(autosave.pending())
      },
    })
  )

  async function send(fields: string[]): Promise<SaveOutcome> {
    const patch = projectPatch(current.current, fields)
    const uploads = Object.values(patch.answers)
      .map((value) => fileAnswer(value)?.path)
      .filter((path) => path !== undefined)
      .filter((path) => unsavedUploads.current.delete(path))
    let result: ProjectPatchResult
    try {
      result = await patchProject({ projectId, ...patch })
    } catch {
      result = { error: "Network error", retry: true }
    } finally {
      saves.current++
    }
    if (result.error) {
      for (const path of uploads) unsavedUploads.current.add(path)
      if (result.retry) return { ok: false, retry: true }
      setMessage(result.error)
      if (result.stale) return { ok: false, stop: true }
      const fieldErrors = result.fieldErrors ?? {}
      const rejected = fields.filter(
        (field) => fieldErrors[fieldErrorKey(field)]
      )
      setErrors((current) => ({
        ...without(current, ["form", ...fields.map(fieldErrorKey)]),
        ...fieldErrors,
      }))
      return { ok: false, invalid: rejected.length > 0 ? rejected : fields }
    }
    const answers = result.answers ?? {}
    const saved: ProjectValues = {
      name: result.name ?? known.current.name,
      trackIds: patch.trackIds ?? known.current.trackIds,
      answers: Object.fromEntries(
        detail.questions
          .filter((question) => question.id in answers)
          .map((question) => [
            question.id,
            editableProjectAnswer(question, answers[question.id]),
          ])
      ),
    }
    known.current = withFields(known.current, saved, fields)
    if (fields.includes(NAME_FIELD)) setTitle?.(saved.name)
    if (result.updatedAt) base.current = result.updatedAt
    setErrors((current) =>
      without(current, ["form", ...fields.map(fieldErrorKey)])
    )
    setMessage(null)
    return { ok: true }
  }

  function stop(reason: string) {
    autosave.stop()
    setMessage(reason)
  }

  async function refresh() {
    const start = saves.current
    const { data, error } = await browserClient().rpc(
      "participant_project_detail",
      { p_project_id: projectId, p_event_id: eventId }
    )
    if (error || stopped.current) return
    if (!data) return stop(NO_ACCESS)
    if (start !== saves.current || autosave.saving()) return
    const latest = projectDetailSchema.parse(data)
    seen.current = latest.project.updated_at
    if (latest.project.status !== "draft") return stop(SUBMITTED)
    base.current = latest.project.updated_at
    setTitle?.(latest.project.name)
    const merged = mergeRemote({
      local: current.current,
      known: known.current,
      remote: projectValues(latest),
      protectedFields: autosave.protectedFields(),
    })
    known.current = merged.known
    deferred.current = new Set(merged.deferred)
    if (merged.changed.length === 0) return
    current.current = merged.values
    setValues(merged.values)
    setRemote((fields) => new Set([...fields, ...merged.changed]))
  }

  const poll = useEffectEvent(async () => {
    if (polling.current || stopped.current) return
    polling.current = true
    try {
      const { data, error } = await browserClient().rpc(
        "participant_project_version",
        { p_project_id: projectId }
      )
      if (error || data === seen.current) return
      if (!data) return stop(NO_ACCESS)
      await refresh()
    } finally {
      polling.current = false
    }
  })

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const start = () => {
      clearInterval(timer)
      if (document.visibilityState !== "visible") return
      timer = setInterval(() => void poll(), POLL_INTERVAL_MS)
    }
    const resume = () => {
      if (document.visibilityState === "visible") void poll()
      start()
    }
    start()
    document.addEventListener("visibilitychange", resume)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", resume)
    }
  }, [])

  useEffect(() => () => autosave.dispose(), [autosave])

  function edit(field: string, next: ProjectValues, immediate: boolean) {
    current.current = next
    setValues(next)
    setRemote((fields) => {
      if (!fields.has(field)) return fields
      const rest = new Set(fields)
      rest.delete(field)
      return rest
    })
    autosave.edit(field, immediate)
  }

  return {
    values,
    errors,
    setErrors,
    remote,
    state,
    pending,
    message,
    setMessage,
    stopped: () => stopped.current,
    base: () => base.current,
    flush: () => autosave.flush(),
    refresh,
    focus: (field: string) => autosave.focus(field),
    blur(field: string) {
      autosave.blur(field)
      if (deferred.current.has(field)) void refresh()
    },
    editName: (name: string) =>
      edit(NAME_FIELD, { ...current.current, name }, false),
    editTracks: (trackIds: string[]) =>
      edit(TRACKS_FIELD, { ...current.current, trackIds }, true),
    editAnswer(question: ProjectQuestion, value: ProjectAnswer) {
      const previous = fileAnswer(current.current.answers[question.id])?.path
      if (
        previous &&
        previous !== fileAnswer(value)?.path &&
        unsavedUploads.current.delete(previous)
      )
        void removeProjectFiles([previous])
      edit(
        question.id,
        {
          ...current.current,
          answers: { ...current.current.answers, [question.id]: value },
        },
        savesImmediately(question.type)
      )
    },
    uploaded: (path: string) => unsavedUploads.current.add(path),
  }
}
