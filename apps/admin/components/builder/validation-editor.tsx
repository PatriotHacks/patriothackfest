"use client"

import {
  DEFAULT_FILE_ACCEPT,
  DEFAULT_FILE_MAX_SIZE_MB,
  type Field,
} from "@workspace/forms"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { useId } from "react"

function compact<T extends Record<string, unknown>>(value: T): T | null {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined)
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : null
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
      const v = field.validation ?? {}
      return (
        <div className="flex gap-3">
          <NumberSetting
            label="Min length"
            value={v.min_length}
            onChange={(min_length) =>
              onChange({ ...field, validation: compact({ ...v, min_length }) })
            }
          />
          <NumberSetting
            label="Max length"
            value={v.max_length}
            onChange={(max_length) =>
              onChange({ ...field, validation: compact({ ...v, max_length }) })
            }
          />
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
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={id}>Accepted MIME types</Label>
            <Input
              id={id}
              className="w-72"
              placeholder={DEFAULT_FILE_ACCEPT.join(", ")}
              value={v.accept?.join(", ") ?? ""}
              onChange={(e) => {
                const accept = e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                onChange({
                  ...field,
                  validation: compact({
                    ...v,
                    accept: accept.length > 0 ? accept : undefined,
                  }),
                })
              }}
            />
          </div>
          <NumberSetting
            label={`Max size in MB (default ${DEFAULT_FILE_MAX_SIZE_MB})`}
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
