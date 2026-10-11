"use client"

import type { Answers } from "@workspace/forms"
import { useCallback, useEffect, useRef, useState } from "react"

import type { ActionResult } from "@/lib/action-result"

export type SaveStatus = "saved" | "saving" | "error"

export function useDraftAutosave(
  save: (answers: Answers) => Promise<ActionResult>,
  delay = 1000
) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const queued = useRef<Answers | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const failed = useRef(false)
  const [status, setStatus] = useState<SaveStatus>("saved")
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(() => {
    clearTimeout(timer.current)
    const answers = queued.current
    if (!answers) return chain.current
    queued.current = null
    chain.current = chain.current.then(async () => {
      const { error } = await save(answers).catch((e: unknown) => ({
        error: e instanceof Error ? e.message : "Save failed",
      }))
      failed.current = error !== null
      if (error && !queued.current) queued.current = answers
      setError(error)
      if (!timer.current || error) setStatus(error ? "error" : "saved")
    })
    return chain.current
  }, [save])

  const schedule = useCallback(
    (answers: Answers) => {
      queued.current = answers
      setStatus("saving")
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = undefined
        void run()
      }, delay)
    },
    [delay, run]
  )

  const flush = useCallback(async () => {
    timer.current = undefined
    if (queued.current) setStatus("saving")
    await run()
    return !failed.current
  }, [run])

  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = undefined
    queued.current = null
  }, [])

  useEffect(() => {
    if (status === "saved") return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [status])

  useEffect(() => () => void run(), [run])

  return { schedule, flush, cancel, status, error }
}
