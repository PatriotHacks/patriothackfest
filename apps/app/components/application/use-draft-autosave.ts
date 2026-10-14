"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { ActionResult } from "@/lib/action-result"

export type SaveStatus = "saved" | "saving" | "error"

export function useDraftAutosave<T>(
  save: (value: T) => Promise<ActionResult>,
  delay = 1000
) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const queued = useRef<T | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const failed = useRef(false)
  const [status, setStatus] = useState<SaveStatus>("saved")
  const [error, setError] = useState<string | null>(null)

  const clearTimer = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = undefined
  }, [])

  const run = useCallback(() => {
    clearTimer()
    const value = queued.current
    if (value === null) return chain.current
    queued.current = null
    chain.current = chain.current.then(async () => {
      const { error } = await save(value).catch((e: unknown) => ({
        error: e instanceof Error ? e.message : "Save failed",
      }))
      failed.current = error !== null
      if (error && queued.current === null) queued.current = value
      setError(error)
      if (!timer.current || error) setStatus(error ? "error" : "saved")
    })
    return chain.current
  }, [save, clearTimer])

  const schedule = useCallback(
    (value: T) => {
      queued.current = value
      setStatus("saving")
      clearTimer()
      const handle = setTimeout(() => {
        if (timer.current === handle) void run()
      }, delay)
      timer.current = handle
    },
    [delay, run, clearTimer]
  )

  const flush = useCallback(async () => {
    if (queued.current !== null) setStatus("saving")
    await run()
    return !failed.current
  }, [run])

  const cancel = useCallback(() => {
    clearTimer()
    queued.current = null
  }, [clearTimer])

  useEffect(() => () => void run(), [run])

  return { schedule, flush, cancel, status, error }
}
