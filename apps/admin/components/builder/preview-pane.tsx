"use client"

import {
  isFieldVisible,
  isSection,
  validateAnswers,
  type AnswerErrors,
  type Answers,
  type Field,
  type Question,
} from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"
import { Textarea } from "@workspace/ui/components/textarea"
import { useId, useState } from "react"

import { BASIC_INFO_FIELDS, BASIC_INFO_TITLE } from "./basic-info-item"

function PreviewInput({
  field,
  value,
  onChange,
}: {
  field: Question
  value: unknown
  onChange: (value: unknown) => void
}) {
  const id = useId()

  switch (field.type) {
    case "short_text":
    case "email":
    case "url":
    case "date":
      return (
        <Input
          id={field.id}
          type={
            field.type === "short_text"
              ? "text"
              : field.type === "email"
                ? "email"
                : field.type
          }
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case "long_text":
      return (
        <Textarea
          id={field.id}
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case "number":
      return (
        <Input
          id={field.id}
          type="number"
          value={(value as number | undefined) ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
      )
    case "single_choice":
      return (
        <RadioGroup
          value={(value as string | undefined) ?? ""}
          onValueChange={onChange}
        >
          {field.options
            .filter((o) => o !== "")
            .map((option, i) => (
              <div key={`${i}-${option}`} className="flex items-center gap-2">
                <RadioGroupItem value={option} id={`${id}-${i}`} />
                <Label htmlFor={`${id}-${i}`}>{option}</Label>
              </div>
            ))}
        </RadioGroup>
      )
    case "multiple_choice": {
      const selected = (value as string[] | undefined) ?? []
      return (
        <div className="flex flex-col gap-2">
          {field.options
            .filter((o) => o !== "")
            .map((option, i) => (
              <div key={`${i}-${option}`} className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-${i}`}
                  checked={selected.includes(option)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...selected, option]
                        : selected.filter((s) => s !== option)
                    )
                  }
                />
                <Label htmlFor={`${id}-${i}`}>{option}</Label>
              </div>
            ))}
        </div>
      )
    }
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.id}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          <Label htmlFor={field.id}>Yes</Label>
        </div>
      )
    case "file":
      return (
        <Input
          id={field.id}
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            onChange(
              file
                ? {
                    path: file.name,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                  }
                : undefined
            )
          }}
        />
      )
  }
}

export function PreviewPane({
  title,
  description,
  fields,
}: {
  title: string
  description: string
  fields: Field[]
}) {
  const [answers, setAnswers] = useState<Answers>({})
  const [errors, setErrors] = useState<AnswerErrors | null>(null)
  const schema = { fields }
  const visible = fields.filter((f) => isFieldVisible(f, answers, schema))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">{title || "Untitled form"}</h2>
        {description && (
          <p className="whitespace-pre-wrap text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="mt-2 border-t pt-4">
        <h3 className="text-lg font-semibold">{BASIC_INFO_TITLE}</h3>
      </div>
      {BASIC_INFO_FIELDS.map(({ label, type, required }, i) => (
        <div key={label} className="flex flex-col gap-1.5">
          <Label htmlFor={`preview-basic-${i}`}>
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
          <Input id={`preview-basic-${i}`} type={type} disabled />
        </div>
      ))}
      {visible.map((field) =>
        isSection(field) ? (
          <div key={field.id} className="mt-2 border-t pt-4">
            <h3 className="text-lg font-semibold">
              {field.label || "Untitled section"}
            </h3>
            {field.help_text && (
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {field.help_text}
              </p>
            )}
          </div>
        ) : (
          <div key={field.id} className="flex flex-col gap-1.5">
            <Label htmlFor={field.id}>
              {field.label || "Untitled question"}
              {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
            <PreviewInput
              field={field}
              value={answers[field.id]}
              onChange={(value) =>
                setAnswers((current) => ({ ...current, [field.id]: value }))
              }
            />
            {errors?.[field.id] && (
              <p className="text-sm text-destructive">{errors[field.id]}</p>
            )}
          </div>
        )
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setErrors(validateAnswers(schema, answers, { mode: "submit" }))
          }
        >
          Check answers
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setAnswers({})
            setErrors(null)
          }}
        >
          Reset
        </Button>
        {errors && Object.keys(errors).length === 0 && (
          <span className="text-sm text-muted-foreground">
            Answers are valid
          </span>
        )}
      </div>
    </div>
  )
}
