import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AUTOSAVE_DELAY_MS,
  createAutosave,
  fieldErrorKey,
  mergeRemote,
  projectPatch,
  retryDelay,
  savesImmediately,
  type AutosaveState,
  type ProjectValues,
  type SaveOutcome,
} from "./project-autosave"

const a = "b0000000-0000-4000-8000-000000000001"
const b = "b0000000-0000-4000-8000-000000000002"
const values = (
  overrides: Partial<ProjectValues> & {
    answers?: ProjectValues["answers"]
  } = {}
): ProjectValues => ({
  name: "Demo",
  trackIds: [],
  ...overrides,
  answers: { [a]: "one", [b]: "two", ...overrides.answers },
})

describe("project patches", () => {
  it("sends only the changed fields", () => {
    expect(projectPatch(values(), [a])).toEqual({ answers: { [a]: "one" } })
    expect(
      projectPatch(values({ trackIds: ["t"] }), ["name", "track_ids", b])
    ).toEqual({ name: "Demo", trackIds: ["t"], answers: { [b]: "two" } })
  })
  it("maps fields to server error keys and save triggers", () => {
    expect(fieldErrorKey("name")).toBe("name")
    expect(fieldErrorKey("track_ids")).toBe("track_ids")
    expect(fieldErrorKey(a)).toBe(`answers.${a}`)
    expect(savesImmediately("single_choice")).toBe(true)
    expect(savesImmediately("file")).toBe(true)
    expect(savesImmediately("long_text")).toBe(false)
  })
  it("backs off retries up to 30 seconds", () => {
    expect([0, 1, 2, 10].map(retryDelay)).toEqual([1000, 2000, 4000, 30000])
  })
})

describe("remote merge", () => {
  const known = values()
  const merge = (
    local: ProjectValues,
    remote: ProjectValues,
    fields: string[] = []
  ) => mergeRemote({ local, known, remote, protectedFields: new Set(fields) })

  it("takes teammate changes and reports them", () => {
    const remote = values({ answers: { [b]: "theirs" } })
    const result = merge(values(), remote)
    expect(result.values.answers[b]).toBe("theirs")
    expect(result.changed).toEqual([b])
    expect(result.known.answers[b]).toBe("theirs")
  })
  it("keeps focused or locally edited fields and defers them", () => {
    const local = values({ answers: { [a]: "mine" } })
    const remote = values({ name: "Theirs", answers: { [a]: "theirs" } })
    const result = merge(local, remote, [a])
    expect(result.values.answers[a]).toBe("mine")
    expect(result.values.name).toBe("Theirs")
    expect(result.deferred).toEqual([a])
    expect(result.known.answers[a]).toBe("one")
  })
  it("ignores fields the server did not change", () => {
    const local = values({ answers: { [a]: "unsaved " } })
    const result = merge(local, values())
    expect(result.values).toBe(local)
    expect(result.changed).toEqual([])
  })
  it("updates known values without a note when both sides already agree", () => {
    const both = values({ answers: { [a]: "same" } })
    const result = merge(both, both)
    expect(result.changed).toEqual([])
    expect(result.known.answers[a]).toBe("same")
  })
  it("compares tracks as sets", () => {
    const result = mergeRemote({
      local: values({ trackIds: ["x", "y"] }),
      known: values({ trackIds: ["x", "y"] }),
      remote: values({ trackIds: ["y", "x"] }),
      protectedFields: new Set(),
    })
    expect(result.changed).toEqual([])
  })
})

describe("autosave scheduling", () => {
  let sends: string[][]
  let outcomes: SaveOutcome[]
  let states: AutosaveState[]
  const setup = () =>
    createAutosave({
      send: async (fields) => {
        sends.push(fields)
        return outcomes.shift() ?? { ok: true }
      },
      onState: (state) => states.push(state),
    })

  beforeEach(() => {
    vi.useFakeTimers()
    sends = []
    outcomes = []
    states = []
  })
  afterEach(() => vi.useRealTimers())

  it("debounces typing and coalesces fields into one save", async () => {
    const autosave = setup()
    autosave.edit(a, false)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
    autosave.edit(b, false)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
    expect(sends).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(sends).toEqual([[a, b]])
    expect(states.at(-1)).toBe("saved")
    expect(autosave.pending()).toBe(false)
  })
  it("saves choices immediately and flushes on blur", async () => {
    const autosave = setup()
    autosave.edit(a, true)
    await vi.advanceTimersByTimeAsync(0)
    expect(sends).toEqual([[a]])
    autosave.focus(b)
    autosave.edit(b, false)
    autosave.blur(b)
    await vi.advanceTimersByTimeAsync(0)
    expect(sends).toEqual([[a], [b]])
  })
  it("protects focused, pending, and in-flight fields", async () => {
    let release: (outcome: SaveOutcome) => void = () => {}
    const autosave = createAutosave({
      send: () => new Promise((resolve) => (release = resolve)),
      onState: () => {},
    })
    autosave.focus("name")
    autosave.edit(a, true)
    await vi.advanceTimersByTimeAsync(0)
    autosave.edit(b, false)
    expect([...autosave.protectedFields()].sort()).toEqual(
      [a, b, "name"].sort()
    )
    expect(autosave.saving()).toBe(true)
    release({ ok: true })
    await vi.advanceTimersByTimeAsync(0)
    autosave.blur("name")
    expect([...autosave.protectedFields()]).toEqual([b])
  })
  it("retries failures with backoff and keeps the fields pending", async () => {
    const autosave = setup()
    outcomes = [
      { ok: false, retry: true },
      { ok: false, retry: true },
    ]
    autosave.edit(a, true)
    await vi.advanceTimersByTimeAsync(0)
    expect(states.at(-1)).toBe("retrying")
    expect(autosave.pending()).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(sends).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1999)
    expect(sends).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(sends).toEqual([[a], [a], [a]])
    expect(states.at(-1)).toBe("saved")
  })
  it("treats a thrown save as retryable", async () => {
    const autosave = createAutosave({
      send: () => Promise.reject(new Error("offline")),
      onState: (state) => states.push(state),
    })
    autosave.edit(a, true)
    await vi.advanceTimersByTimeAsync(0)
    expect(states.at(-1)).toBe("retrying")
    autosave.dispose()
  })
  it("holds rejected fields until edited and saves the rest", async () => {
    const autosave = setup()
    outcomes = [{ ok: false, invalid: [a] }]
    autosave.edit(a, false)
    autosave.edit(b, false)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 1)
    expect(sends).toEqual([[a, b], [b]])
    expect(states.at(-1)).toBe("error")
    expect(await autosave.flush()).toBe(false)
    expect(autosave.protectedFields().has(a)).toBe(true)
    autosave.edit(a, true)
    await vi.advanceTimersByTimeAsync(0)
    expect(sends.at(-1)).toEqual([a])
    expect(states.at(-1)).toBe("saved")
  })
  it("reports whether a flush left anything unsaved", async () => {
    const autosave = setup()
    autosave.edit(a, false)
    expect(await autosave.flush()).toBe(true)
    expect(sends).toEqual([[a]])
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(sends).toEqual([[a]])
  })
  it("stops saving when the project can no longer be autosaved", async () => {
    const autosave = setup()
    outcomes = [{ ok: false, stop: true }]
    autosave.edit(a, true)
    await vi.advanceTimersByTimeAsync(0)
    expect(states.at(-1)).toBe("stopped")
    autosave.edit(b, true)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(sends).toEqual([[a]])
    expect(await autosave.flush()).toBe(false)
  })
})
