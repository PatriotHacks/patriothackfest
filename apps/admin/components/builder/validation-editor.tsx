"use client"

import {
  DEFAULT_FILE_MAX_SIZE_MB,
  LENGTH_UNIT_LABELS,
  LENGTH_UNITS,
  limitForUnit,
  MAX_FILE_SIZE_MB,
  MAX_WORD_LIMIT,
  WORD_LIMIT_MESSAGE,
  type Field,
  type LengthUnit,
  type TextValidation,
} from "@workspace/forms"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { useId, useState } from "react"

function compact<T extends Record<string, unknown>>(value: T): T | null {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined)
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : null
}

function textValidation(v: TextValidation) {
  return v.min_length === undefined &&
    v.max_length === undefined &&
    v.length_unit === "characters"
    ? null
    : compact(v)
}

function LengthUnitSetting({
  value,
  onChange,
}: {
  value: LengthUnit
  onChange: (value: LengthUnit) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>Count</Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as LengthUnit)}
      >
        <SelectTrigger id={id} className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LENGTH_UNITS.map((unit) => (
            <SelectItem key={unit} value={unit}>
              {LENGTH_UNIT_LABELS[unit]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function toNumber(value: string) {
  return value === "" ? undefined : Number(value)
}

function NumberSetting({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        className="w-32"
        value={value ?? ""}
        onChange={(e) => onChange(toNumber(e.target.value))}
      />
    </div>
  )
}

function isValidFileSize(size: number) {
  return size > 0 && size <= MAX_FILE_SIZE_MB
}

export function FileSizeInput({
  value,
  error,
  onChange,
  onBlur,
}: {
  value: string
  error: string | null
  onChange: (value: string) => void
  onBlur?: () => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>
        Max size in MB (default {DEFAULT_FILE_MAX_SIZE_MB})
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={MAX_FILE_SIZE_MB}
        step="any"
        className="w-32"
        value={value}
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function FileSizeSetting({
  value,
  onChange,
}: {
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "")
  const [invalid, setInvalid] = useState(false)

  function commit() {
    const ok = draft === "" || isValidFileSize(Number(draft))
    setInvalid(!ok)
    if (ok) onChange(draft === "" ? undefined : Number(draft))
  }

  return (
    <FileSizeInput
      value={draft}
      error={
        invalid
          ? `Enter a size greater than 0 and at most ${MAX_FILE_SIZE_MB} MB`
          : null
      }
      onChange={setDraft}
      onBlur={commit}
    />
  )
}

function DateSetting({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        className="w-44"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </div>
  )
}

export function ValidationEditor({
  field,
  onChange,
}: {
  field: Field
  onChange: (field: Field) => void
}) {
  const id = useId()

  switch (field.type) {
    case "short_text":
    case "long_text": {
      const v = field.validation ?? { length_unit: "characters" }
      const set = (next: Partial<TextValidation>) =>
        onChange({ ...field, validation: textValidation({ ...v, ...next }) })
      const overCap =
        v.length_unit === "words" &&
        Math.max(v.min_length ?? 0, v.max_length ?? 0) > MAX_WORD_LIMIT
      return (
        <div className="flex flex-col gap-1">
          <div className="flex gap-3">
            <NumberSetting
              label="Min length"
              value={v.min_length}
              onChange={(min_length) => set({ min_length })}
            />
            <NumberSetting
              label="Max length"
              value={v.max_length}
              onChange={(max_length) => set({ max_length })}
            />
            <LengthUnitSetting
              value={v.length_unit}
              onChange={(length_unit) =>
                set({
                  length_unit,
                  min_length:
                    v.min_length === undefined
                      ? undefined
                      : limitForUnit(v.min_length, length_unit),
                  max_length:
                    v.max_length === undefined
                      ? undefined
                      : limitForUnit(v.max_length, length_unit),
                })
              }
            />
          </div>
          {overCap && (
            <p className="text-xs text-destructive">{WORD_LIMIT_MESSAGE}</p>
          )}
        </div>
      )
    }
    case "number": {
      const v = field.validation ?? {}
      return (
        <div className="flex items-end gap-3">
          <NumberSetting
            label="Min"
            value={v.min}
            onChange={(min) =>
              onChange({ ...field, validation: compact({ ...v, min }) })
            }
          />
          <NumberSetting
            label="Max"
            value={v.max}
            onChange={(max) =>
              onChange({ ...field, validation: compact({ ...v, max }) })
            }
          />
          <div className="flex items-center gap-2 pb-1.5">
            <Switch
              id={id}
              checked={v.integer ?? false}
              onCheckedChange={(integer) =>
                onChange({
                  ...field,
                  validation: compact({ ...v, integer: integer || undefined }),
                })
              }
            />
            <Label htmlFor={id}>Whole numbers only</Label>
          </div>
        </div>
      )
    }
    case "date": {
      const v = field.validation ?? {}
      return (
        <div className="flex gap-3">
          <DateSetting
            label="Earliest"
            value={v.min}
            onChange={(min) =>
              onChange({ ...field, validation: compact({ ...v, min }) })
            }
          />
          <DateSetting
            label="Latest"
            value={v.max}
            onChange={(max) =>
              onChange({ ...field, validation: compact({ ...v, max }) })
            }
          />
        </div>
      )
    }
    case "file": {
      const v = field.validation ?? {}
      return (
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Accepted file type</span>
            <span className="text-sm text-muted-foreground">PDF only</span>
          </div>
          <FileSizeSetting
            value={v.max_size_mb}
            onChange={(max_size_mb) =>
              onChange({ ...field, validation: compact({ ...v, max_size_mb }) })
            }
          />
        </div>
      )
    }
    default:
      return null
  }
}
