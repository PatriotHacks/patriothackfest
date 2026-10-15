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
} from "@workspace/forms"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  saveAnswers,
  submitApplication,
} from "@/app/(applicant)/(main)/applications/[id]/actions"
import { AuthButton, AuthError } from "@/components/auth/auth-fields"
import {
  BASIC_INFO_KEYS,
  basicInfoDraftErrors,
  draftFromProfile,
  toBasicInfo,
  type BasicInfoDraft,
  type BasicInfoErrors,
  type BasicInfoKey,
  type Profile,
} from "@/lib/basic-info"
import { saveBasicInfo } from "@/lib/basic-info-actions"

import { useFileCleanup, useStaleCheck } from "./application-hooks"
import { basicFieldId, BasicInfoFields } from "./basic-info-fields"
import { fieldContainerId, fieldInputId } from "./field-ids"
import { FormHelp, FormSection, SectionHeading } from "./form-controls"
import { QuestionField } from "./question-field"
import { SaveIndicator } from "./save-indicator"
import { StaleAlert } from "./stale-alert"
import { useDraftAutosave, type SaveStatus } from "./use-draft-autosave"

type Props = {
  applicationId: string
  userId: string
  email: string
  profile: Profile
  basicLocked: boolean
  schema: PublishedSchema
  initialAnswers: Answers
  updatedAt: string
  editNote: string | null
}

function focusElement(containerId: string, inputId: string) {
  document
    .getElementById(containerId)
    ?.scrollIntoView({ behavior: "smooth", block: "center" })
  const input = document.getElementById(inputId)
  const target =
    input?.querySelector<HTMLElement>("button, input") ?? input ?? null
  target?.focus({ preventScroll: true })
}

function combinedStatus(a: SaveStatus, b: SaveStatus): SaveStatus {
  if (a === "error" || b === "error") return "error"
  if (a === "saving" || b === "saving") return "saving"
  return "saved"
}

export function DraftForm({
  applicationId,
  userId,
  email,
  profile,
  basicLocked,
  schema,
  initialAnswers,
  updatedAt,
  editNote,
}: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState(initialAnswers)
  const answersRef = useRef(initialAnswers)
  const lastKnown = useRef(updatedAt)
  const [initialBasic] = useState(() => draftFromProfile(profile))
  const [basic, setBasic] = useState(initialBasic)
  const [errors, setErrors] = useState<AnswerErrors>({})
  const [basicErrors, setBasicErrors] = useState<BasicInfoErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(0)
  const { replaced, removeUnreferenced } = useFileCleanup()

  const persistAnswers = useCallback(
    async (snapshot: Answers) => {
      const result = await saveAnswers(applicationId, snapshot)
      if (result.error) return result
      lastKnown.current = result.updatedAt!
      removeUnreferenced(snapshot, snapshot)
      return result
    },
    [applicationId, removeUnreferenced]
  )
  const persistBasic = useCallback(
    (draft: BasicInfoDraft) => saveBasicInfo(toBasicInfo(draft)),
    []
  )

  const answersSave = useDraftAutosave(persistAnswers)
  const basicSave = useDraftAutosave(persistBasic)
  const [stale, setStale] = useStaleCheck(
    applicationId,
    lastKnown,
    busy || answersSave.status === "saving"
  )

  function updateAnswer(field: Question, value: unknown) {
    replaced(answersRef.current[field.id], value)
    const next = { ...answersRef.current }
    if (value === undefined) delete next[field.id]
    else next[field.id] = value
    answersRef.current = next
    setAnswers(next)
    if (errors[field.id]) {
      const rest = { ...errors }
      delete rest[field.id]
      setErrors(rest)
    }
    answersSave.schedule(next)
    if (field.type === "file") void answersSave.flush()
  }

  function updateBasic(next: BasicInfoDraft, key: BasicInfoKey) {
    setBasic(next)
    if (basicErrors[key]) {
      const rest = { ...basicErrors }
      delete rest[key]
      setBasicErrors(rest)
    }
    basicSave.schedule(next)
  }

  function showErrors(nextBasic: BasicInfoErrors, nextAnswers: AnswerErrors) {
    setBasicErrors(nextBasic)
    setErrors(nextAnswers)
    const basicKey = BASIC_INFO_KEYS.find((key) => nextBasic[key])
    const question = schema.fields.find(
      (f) => nextAnswers[f.id] && isFieldVisible(f, answersRef.current, schema)
    )
    requestAnimationFrame(() => {
      if (basicKey) focusElement(basicFieldId(basicKey), basicFieldId(basicKey))
      else if (question)
        focusElement(fieldContainerId(question.id), fieldInputId(question.id))
    })
    setFormError(
      basicKey || question
        ? "Some answers need attention"
        : Object.values(nextAnswers).join(". ")
    )
  }

  async function submit() {
    setBusy(true)
    setFormError(null)
    try {
      const saved = await Promise.all([answersSave.flush(), basicSave.flush()])
      if (saved.includes(false)) {
        setFormError("Your answers could not be saved. Try again.")
        return
      }
      const localBasic = basicInfoDraftErrors(basic, "submit")
      const localAnswers = validateAnswers(schema, answersRef.current, {
        mode: "submit",
      })
      if (
        Object.keys(localBasic).length > 0 ||
        Object.keys(localAnswers).length > 0
      )
        return showErrors(localBasic, localAnswers)
      const result = await submitApplication(applicationId)
      if (result.fieldErrors) {
        const serverBasic: BasicInfoErrors = {}
        const serverAnswers: AnswerErrors = {}
        for (const [key, message] of Object.entries(result.fieldErrors)) {
          if ((BASIC_INFO_KEYS as readonly string[]).includes(key))
            serverBasic[key as BasicInfoKey] = message
          else serverAnswers[key] = message
        }
        return showErrors(serverBasic, serverAnswers)
      }
      if (result.error) return setFormError(result.error)
      removeUnreferenced(
        answersRef.current,
        pruneHiddenAnswers(schema, answersRef.current)
      )
      router.push("/")
    } finally {
      setBusy(false)
    }
  }

  function reload() {
    answersSave.cancel()
    setStale(false)
    router.refresh()
  }

  const groups = groupSections(schema.fields).filter(
    ({ section }) => !section || isFieldVisible(section, answers, schema)
  )
  const phoneIncomplete =
    toBasicInfo(basic).phone === null &&
    (basic.phoneCountry !== initialBasic.phoneCountry ||
      basic.phoneNational !== initialBasic.phoneNational)
  const saveStatus = combinedStatus(answersSave.status, basicSave.status)
  const status =
    phoneIncomplete && saveStatus === "saved" ? "incomplete" : saveStatus

  useEffect(() => {
    if (status === "saved") return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [status])

  return (
    <div className="flex flex-col gap-[28px] text-left">
      {stale && (
        <StaleAlert onReload={reload} onDismiss={() => setStale(false)} />
      )}
      <BasicInfoFields
        value={basic}
        errors={basicErrors}
        email={email}
        disabled={busy || basicLocked}
        muted={basicLocked}
        onChange={updateBasic}
        onBlur={() => void basicSave.flush()}
      />
      {groups.map(({ section, questions }, i) => (
        <FormSection key={section?.id ?? `untitled-${i}`}>
          {section && (
            <SectionHeading
              title={section.label}
              description={section.help_text}
            />
          )}
          {questions
            .filter((f) => isFieldVisible(f, answers, schema))
            .map((field) => (
              <QuestionField
                key={field.id}
                field={field}
                value={answers[field.id]}
                error={errors[field.id]}
                disabled={busy}
                userId={userId}
                applicationId={applicationId}
                onChange={(value) => updateAnswer(field, value)}
                onBlur={() => void answersSave.flush()}
                onUploadingChange={(active) =>
                  setUploading((n) => n + (active ? 1 : -1))
                }
              />
            ))}
        </FormSection>
      ))}
      <div className="flex flex-col items-center gap-[10px] border-t border-[#E7E4D9] pt-[8px]">
        {formError && <AuthError className="w-full">{formError}</AuthError>}
        <AuthButton
          type="button"
          onClick={submit}
          disabled={busy || uploading > 0}
          className="mt-[16px]"
        >
          {busy ? "Submitting..." : "Submit application"}
        </AuthButton>
        <SaveIndicator
          status={status}
          error={
            status === "incomplete"
              ? "Phone number incomplete"
              : (answersSave.error ?? basicSave.error)
          }
        />
        {editNote && <FormHelp className="text-center">{editNote}</FormHelp>}
      </div>
    </div>
  )
}
