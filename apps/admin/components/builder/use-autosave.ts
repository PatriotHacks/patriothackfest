"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { ActionResult } from "@/lib/action-result"

export type SaveStatus = "saved" | "saving" | "error"
type Run = () => Promise<ActionResult>

export function useAutosave(delay = 700) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const queued = useRef(new Map<string, Run>())
  const chains = useRef(new Map<string, Promise<void>>())
  const errorsRef = useRef(new Map<string, string>())
  const [pending, setPending] = useState(0)
  const [errors, setErrors] = useState<Map<string, string>>(new Map())

  const setKeyError = useCallback((key: string, error: string | null) => {
    if (error) errorsRef.current.set(key, error)
    else errorsRef.current.delete(key)
    setErrors(new Map(errorsRef.current))
  }, [])

  const start = useCallback(
    (key: string) => {
      const run = queued.current.get(key)
      if (!run) return
      queued.current.delete(key)
      timers.current.delete(key)
      const chain = (chains.current.get(key) ?? Promise.resolve()).then(
        async () => {
          try {
            const { error } = await run()
            setKeyError(key, error)
          } catch (e) {
            setKeyError(key, e instanceof Error ? e.message : "Save failed")
          } finally {
            setPending((p) => p - 1)
          }
        }
      )
      chains.current.set(key, chain)
    },
    [setKeyError]
  )

  const schedule = useCallback(
    (key: string, run: Run, wait = delay) => {
      if (!queued.current.has(key)) setPending((p) => p + 1)
      queued.current.set(key, run)
      clearTimeout(timers.current.get(key))
      timers.current.set(
        key,
        setTimeout(() => start(key), wait)
      )
    },
    [delay, start]
  )

  const flush = useCallback(async () => {
    for (const [key, timer] of timers.current) {
      clearTimeout(timer)
      start(key)
    }
    await Promise.all(chains.current.values())
    return errorsRef.current.size === 0
  }, [start])

  useEffect(() => {
    if (pending === 0) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [pending])

  const status: SaveStatus =
    pending > 0 ? "saving" : errors.size > 0 ? "error" : "saved"
  const error = errors.values().next().value ?? null

  return { schedule, flush, status, error }
}
