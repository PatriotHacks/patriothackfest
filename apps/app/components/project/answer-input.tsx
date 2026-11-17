"use client"

import {
  fileAnswer,
  formatLength,
  MAX_PROJECT_ANSWER_LENGTH,
  MAX_PROJECT_URL_LENGTH,
  type ProjectAnswer,
  textLength,
  type ProjectQuestion,
} from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { ProjectFileAnswer } from "./file-answer"

export function ProjectAnswerInput({
  id,
  projectId,
  question,
  value,
  error,
  onChange,
  onUploaded,
  onUploadingChange,
}: {
  id: string
  projectId: string
  question: ProjectQuestion
  value: ProjectAnswer
  error: string | undefined
  onChange: (value: ProjectAnswer) => void
  onUploaded: (path: string) => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const inputId = `${id}-${question.id}`
  const helpId = question.help_text ? `${inputId}-help` : undefined
  const limit = question.max_length
  const countId = limit ? `${inputId}-count` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy =
    [helpId, countId, errorId].filter(Boolean).join(" ") || undefined
  const text = typeof value === "string" ? value : ""
  const words = question.length_unit === "words"
  const count = textLength(text, question.length_unit)
  const inputMax = words ? MAX_PROJECT_ANSWER_LENGTH : question.max_length
  const overLimit = limit !== null && count > limit
  const selected = Array.isArray(value) ? value : []
  const choice = question.type === "single_choice" ? text : null
  const grouped =
    question.type === "single_choice" || question.type === "multiple_choice"
  const title = `${question.label}${question.required ? " (required)" : " (optional)"}`

  function control() {
    switch (question.type) {
      case "short_text":
      case "url":
        return (
          <Input
            id={inputId}
            type={question.type === "url" ? "url" : "text"}
            maxLength={inputMax ?? MAX_PROJECT_URL_LENGTH}
            value={text}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
        )
      case "long_text":
        return (
          <Textarea
            id={inputId}
            rows={5}
            maxLength={inputMax ?? undefined}
            value={text}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
        )
      case "single_choice":
        return (
          <>
            {(question.options ?? []).map((option) => (
              <label key={option.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={inputId}
                  checked={choice === option.id}
                  onChange={() => onChange(option.id)}
                />
                {option.label}
              </label>
            ))}
            {!question.required && choice && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() => onChange("")}
              >
                Clear selection
              </Button>
            )}
          </>
        )
      case "multiple_choice":
        return (question.options ?? []).map((option) => (
          <label key={option.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? (question.options ?? [])
                        .map((o) => o.id)
                        .filter((o) => o === option.id || selected.includes(o))
                    : selected.filter((o) => o !== option.id)
                )
              }
            />
            {option.label}
          </label>
        ))
      case "file":
        return (
          <ProjectFileAnswer
            inputId={inputId}
            projectId={projectId}
            question={question}
            value={fileAnswer(value)}
            invalid={Boolean(error)}
            describedBy={describedBy}
            onChange={onChange}
            onUploaded={onUploaded}
            onUploadingChange={onUploadingChange}
          />
        )
    }
  }

  const details = (
    <>
      {helpId && (
        <p id={helpId} className="text-sm text-[#6E6E68]">
          {question.help_text}
        </p>
      )}
      {control()}
      {countId && limit && (
        <p
          id={countId}
          className={cn(
            "text-right text-xs",
            overLimit ? "text-red-700" : "text-[#6E6E68]"
          )}
        >
          {`${count}/${formatLength(limit, question.length_unit)}`}
        </p>
      )}
      {errorId && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </>
  )

  return grouped ? (
    <fieldset className="flex flex-col gap-1" aria-describedby={describedBy}>
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      {details}
    </fieldset>
  ) : (
    <div className="flex flex-col gap-1">
      <Label htmlFor={inputId}>{title}</Label>
      {details}
    </div>
  )
}
