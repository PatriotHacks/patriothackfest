"use client"

import {
  groupSections,
  isFieldVisible,
  pruneHiddenAnswers,
  validateAnswers,
  type AnswerErrors,
  type Answers,
  type PublishedSchema,
  type Question,
  type SectionGroup,
} from "@workspace/forms"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { saveAnswers } from "@/app/(applicant)/(main)/applications/[id]/actions"
import { AuthButton, AuthError } from "@/components/auth/auth-fields"

import { useFileCleanup, useStaleCheck } from "./application-hooks"
import { AnswerList } from "./answers-view"
import { fieldContainerId, fieldInputId } from "./field-ids"
import { FormSection, SectionHeading } from "./form-controls"
import { QuestionField } from "./question-field"
import { StaleAlert } from "./stale-alert"

type Props = {
  applicationId: string
  userId: string
  schema: PublishedSchema
  initialAnswers: Answers
  updatedAt: string
  editable: boolean
}

type SectionState = {
  dirty?: boolean
  error?: string
  message?: string
}

const groupKey = (group: SectionGroup, index: number) =>
  group.section?.id ?? `untitled-${index}`

function focusQuestion(id: string) {
  document
    .getElementById(fieldContainerId(id))
    ?.scrollIntoView({ behavior: "smooth", block: "center" })
  const input = document.getElementById(fieldInputId(id))
  const target =
    input?.querySelector<HTMLElement>("button, input") ?? input ?? null
  target?.focus({ preventScroll: true })
}

export function SubmittedApplication({
  applicationId,
  userId,
  schema,
  initialAnswers,
  updatedAt,
  editable,
}: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState(initialAnswers)
  const answersRef = useRef(initialAnswers)
  const savedRef = useRef(initialAnswers)
  const lastKnown = useRef(updatedAt)
  const [errors, setErrors] = useState<AnswerErrors>({})
  const [sections, setSections] = useState<Record<string, SectionState>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [uploading, setUploading] = useState(0)
  const { replaced, removeUnreferenced } = useFileCleanup()
  const [stale, setStale] = useStaleCheck(
    applicationId,
    lastKnown,
    busy !== null
  )

  const anyDirty = Object.values(sections).some((s) => s.dirty)
  useEffect(() => {
    if (!anyDirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [anyDirty])

  function setSection(key: string, state: SectionState) {
    setSections((current) => ({ ...current, [key]: state }))
  }

  function update(key: string, field: Question, value: unknown) {
    replaced(answersRef.current[field.id], value)
    const next = { ...answersRef.current }
    if (value === undefined) delete next[field.id]
    else next[field.id] = value
    answersRef.current = next
    setAnswers(next)
    setSection(key, { dirty: true })
    if (errors[field.id]) {
      const rest = { ...errors }
      delete rest[field.id]
      setErrors(rest)
    }
  }

  async function save(key: string, questions: readonly Question[]) {
    const ids = new Set(questions.map((q) => q.id))
    const merged = { ...savedRef.current }
    for (const id of ids) {
      if (Object.hasOwn(answersRef.current, id))
        merged[id] = answersRef.current[id]
      else delete merged[id]
    }
    const skip = new Set(
      schema.fields.filter((f) => !ids.has(f.id)).map((f) => f.id)
    )
    const local = validateAnswers(schema, merged, { mode: "submit", skip })
    if (Object.keys(local).length > 0) return showErrors(key, local)

    setBusy(key)
    setSection(key, { dirty: true })
    try {
      const stored = pruneHiddenAnswers(schema, merged)
      const result = await saveAnswers(applicationId, stored)
      if (result.fieldErrors) return showErrors(key, result.fieldErrors)
      if (result.error)
        return setSection(key, { dirty: true, error: result.error })
      lastKnown.current = result.updatedAt!
      removeUnreferenced(merged, stored)
      savedRef.current = stored
      const next = { ...answersRef.current }
      for (const id of ids) {
        if (Object.hasOwn(stored, id)) next[id] = stored[id]
        else delete next[id]
      }
      answersRef.current = next
      setAnswers(next)
      setSection(key, { message: "Changes saved" })
    } finally {
      setBusy(null)
    }
  }

  function showErrors(key: string, next: AnswerErrors) {
    setErrors((current) => ({ ...current, ...next }))
    const first = schema.fields.find(
      (f) => next[f.id] && isFieldVisible(f, answersRef.current, schema)
    )
    if (first) requestAnimationFrame(() => focusQuestion(first.id))
    setSection(key, {
      dirty: true,
      error: first
        ? "Some answers need attention"
        : Object.values(next).join(". "),
    })
  }

  function reload() {
    setSections({})
    setStale(false)
    router.refresh()
  }

  const groups = groupSections(schema.fields).filter(
    ({ section }) => !section || isFieldVisible(section, answers, schema)
  )

  return (
    <>
      {stale && (
        <StaleAlert onReload={reload} onDismiss={() => setStale(false)} />
      )}
      {groups.map((group, i) => {
        const key = groupKey(group, i)
        const open = editable && group.section?.editable_after_submit === true
        const state = sections[key] ?? {}
        return (
          <FormSection key={key} muted={!open}>
            {group.section && (
              <SectionHeading
                title={group.section.label}
                description={group.section.help_text}
              />
            )}
            {open ? (
              <>
                {group.questions
                  .filter((f) => isFieldVisible(f, answers, schema))
                  .map((field) => (
                    <QuestionField
                      key={field.id}
                      field={field}
                      value={answers[field.id]}
                      error={errors[field.id]}
                      disabled={busy !== null}
                      userId={userId}
                      applicationId={applicationId}
                      onChange={(value) => update(key, field, value)}
                      onBlur={() => {}}
                      onUploadingChange={(active) =>
                        setUploading((n) => n + (active ? 1 : -1))
                      }
                    />
                  ))}
                {state.error && <AuthError>{state.error}</AuthError>}
                <div className="flex flex-wrap items-center gap-[14px]">
                  <AuthButton
                    type="button"
                    className="mt-0 w-auto px-[28px]"
                    onClick={() => save(key, group.questions)}
                    disabled={busy !== null || uploading > 0 || !state.dirty}
                  >
                    {busy === key ? "Saving..." : "Save changes"}
                  </AuthButton>
                  {state.dirty && busy !== key && (
                    <span className="text-[13px] text-[#6E6E68]">
                      Unsaved changes
                    </span>
                  )}
                  {state.message && (
                    <span role="status" className="text-[13px] text-[#6E6E68]">
                      {state.message}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <AnswerList
                schema={schema}
                answers={answers}
                questions={group.questions}
              />
            )}
          </FormSection>
        )
      })}
    </>
  )
}
