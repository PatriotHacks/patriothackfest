import type { ProjectQuestion } from "@workspace/forms"

import {
  projectAnswers,
  type ProjectAnswers,
  type ProjectDetail,
} from "./projects"

export const AUTOSAVE_DELAY_MS = 2000
export const POLL_INTERVAL_MS = 4000
export const NAME_FIELD = "name"
export const TRACKS_FIELD = "track_ids"

export type ProjectValues = {
  name: string
  answers: ProjectAnswers
  trackIds: string[]
}

export type ProjectPatch = {
  name?: string
  answers: ProjectAnswers
  trackIds?: string[]
}

export function projectValues(detail: ProjectDetail): ProjectValues {
  return {
    name: detail.project.name,
    answers: projectAnswers(detail),
    trackIds: detail.selected_tracks.map((track) => track.id),
  }
}

export function savesImmediately(type: ProjectQuestion["type"]) {
  return (
    type === "single_choice" || type === "multiple_choice" || type === "file"
  )
}

export function retryDelay(attempt: number) {
  return Math.min(30_000, 1000 * 2 ** attempt)
}

export function fieldErrorKey(field: string) {
  return field === NAME_FIELD || field === TRACKS_FIELD
    ? field
    : `answers.${field}`
}

export function projectPatch(
  values: ProjectValues,
  fields: Iterable<string>
): ProjectPatch {
  const patch: ProjectPatch = { answers: {} }
  for (const field of fields) {
    if (field === NAME_FIELD) patch.name = values.name
    else if (field === TRACKS_FIELD) patch.trackIds = values.trackIds
    else patch.answers[field] = values.answers[field] ?? null
  }
  return patch
}

function fieldValue(values: ProjectValues, field: string) {
  if (field === NAME_FIELD) return values.name
  if (field === TRACKS_FIELD) return [...values.trackIds].sort()
  return values.answers[field] ?? null
}

function sameField(a: ProjectValues, b: ProjectValues, field: string) {
  return (
    JSON.stringify(fieldValue(a, field)) ===
    JSON.stringify(fieldValue(b, field))
  )
}

function withField(
  values: ProjectValues,
  source: ProjectValues,
  field: string
): ProjectValues {
  if (field === NAME_FIELD) return { ...values, name: source.name }
  if (field === TRACKS_FIELD) return { ...values, trackIds: source.trackIds }
  return {
    ...values,
    answers: { ...values.answers, [field]: source.answers[field] ?? null },
  }
}

export function projectFields(values: ProjectValues) {
  return [NAME_FIELD, TRACKS_FIELD, ...Object.keys(values.answers)]
}

// Three-way merge against the last server state this client knew. A field
// changed remotely is taken unless it is protected (focused or edited
// locally); protected fields keep the local value and stay deferred.
export function mergeRemote({
  local,
  known,
  remote,
  protectedFields,
}: {
  local: ProjectValues
  known: ProjectValues
  remote: ProjectValues
  protectedFields: ReadonlySet<string>
}) {
  let values = local
  let nextKnown = known
  const changed: string[] = []
  const deferred: string[] = []
  for (const field of projectFields(local)) {
    if (sameField(remote, known, field)) continue
    if (protectedFields.has(field)) {
      deferred.push(field)
      continue
    }
    nextKnown = withField(nextKnown, remote, field)
    if (sameField(local, remote, field)) continue
    values = withField(values, remote, field)
    changed.push(field)
  }
  return { values, known: nextKnown, changed, deferred }
}

export function withFields(
  values: ProjectValues,
  source: ProjectValues,
  fields: Iterable<string>
) {
  let next = values
  for (const field of fields) next = withField(next, source, field)
  return next
}

export type SaveOutcome =
  | { ok: true }
  | { ok: false; retry: true }
  | { ok: false; invalid: string[] }
  | { ok: false; stop: true }

export type AutosaveState =
  "saved" | "saving" | "retrying" | "error" | "stopped"

// Debounced, serialized saves of changed fields. Fields the server rejected
// wait for the next edit instead of blocking the rest.
export function createAutosave({
  send,
  onState,
}: {
  send: (fields: string[]) => Promise<SaveOutcome>
  onState: (state: AutosaveState) => void
}) {
  const dirty = new Set<string>()
  const inflight = new Set<string>()
  const invalid = new Set<string>()
  let focused: string | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let queue = Promise.resolve(true)
  let attempt = 0
  let stopped = false

  function schedule(delay: number) {
    clearTimeout(timer)
    timer = setTimeout(() => void flush(), delay)
  }

  function settled() {
    return dirty.size === 0 && invalid.size === 0
  }

  async function run() {
    if (stopped) return false
    const fields = [...dirty]
    if (fields.length === 0) return settled()
    dirty.clear()
    for (const field of fields) inflight.add(field)
    onState("saving")
    const outcome = await send(fields).catch((): SaveOutcome => ({
      ok: false,
      retry: true,
    }))
    inflight.clear()
    if (stopped) return false
    if (outcome.ok) {
      attempt = 0
      onState(dirty.size > 0 ? "saving" : invalid.size > 0 ? "error" : "saved")
      return settled()
    }
    if ("stop" in outcome) {
      for (const field of fields) dirty.add(field)
      stop()
      return false
    }
    if ("retry" in outcome) {
      for (const field of fields) dirty.add(field)
      onState("retrying")
      schedule(retryDelay(attempt++))
      return false
    }
    const rejected = new Set(outcome.invalid)
    for (const field of fields)
      (rejected.has(field) ? invalid : dirty).add(field)
    if (dirty.size > 0) schedule(0)
    onState("error")
    return false
  }

  function flush() {
    clearTimeout(timer)
    queue = queue.then(run)
    return queue
  }

  function stop() {
    stopped = true
    clearTimeout(timer)
    onState("stopped")
  }

  return {
    flush,
    stop,
    edit(field: string, immediate: boolean) {
      if (stopped) return
      invalid.delete(field)
      dirty.add(field)
      onState("saving")
      schedule(immediate ? 0 : AUTOSAVE_DELAY_MS)
    },
    focus(field: string) {
      focused = field
    },
    blur(field: string) {
      if (focused === field) focused = null
      if (dirty.has(field)) void flush()
    },
    protectedFields() {
      const fields = new Set([...dirty, ...inflight, ...invalid])
      if (focused) fields.add(focused)
      return fields
    },
    saving() {
      return inflight.size > 0
    },
    pending() {
      return dirty.size + inflight.size + invalid.size > 0
    },
    dispose() {
      stopped = true
      clearTimeout(timer)
    },
  }
}
