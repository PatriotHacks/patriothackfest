"use client"

import { fileAnswerSchema, type Answers } from "@workspace/forms"
import { useCallback, useEffect, useRef, useState } from "react"

import { getUpdatedAt } from "@/app/(applicant)/(main)/applications/[id]/actions"
import { removeFiles } from "@/lib/application-files"

function filePath(value: unknown) {
  const parsed = fileAnswerSchema.safeParse(value)
  return parsed.success ? parsed.data.path : null
}

function filePaths(answers: Answers) {
  return Object.values(answers)
    .map(filePath)
    .filter((path) => path !== null)
}

export function useFileCleanup() {
  const pendingDeletes = useRef(new Set<string>())

  const replaced = useCallback((previous: unknown, next: unknown) => {
    const path = filePath(previous)
    if (path && path !== filePath(next)) pendingDeletes.current.add(path)
  }, [])

  const removeUnreferenced = useCallback(
    (previous: Answers, stored: Answers) => {
      const referenced = new Set(filePaths(stored))
      const removable = [
        ...new Set([...pendingDeletes.current, ...filePaths(previous)]),
      ].filter((path) => !referenced.has(path))
      removable.forEach((path) => pendingDeletes.current.delete(path))
      void removeFiles(removable)
    },
    []
  )

  return { replaced, removeUnreferenced }
}

export function useStaleCheck(
  applicationId: string,
  lastKnown: React.RefObject<string>,
  saving: boolean
) {
  const [stale, setStale] = useState(false)
  const savingRef = useRef(saving)
  useEffect(() => {
    savingRef.current = saving
  }, [saving])

  useEffect(() => {
    async function check() {
      if (savingRef.current) return
      const result = await getUpdatedAt(applicationId)
      if (result.updatedAt && result.updatedAt !== lastKnown.current)
        setStale(true)
    }
    window.addEventListener("focus", check)
    return () => window.removeEventListener("focus", check)
  }, [applicationId, lastKnown])

  return [stale, setStale] as const
}
