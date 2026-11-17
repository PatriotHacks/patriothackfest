"use client"

import type { ChoiceOption } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

function OptionRows({
  rows,
  onRename,
  onRemove,
  onAdd,
}: {
  rows: { key: string; label: string }[]
  onRename: (index: number, label: string) => void
  onRemove: (index: number) => void
  onAdd: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Options</Label>
      {rows.map((row, index) => (
        <div key={row.key} className="flex gap-2">
          <Input
            value={row.label}
            aria-label={`Option ${index + 1}`}
            onChange={(e) => onRename(index, e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={onAdd}
      >
        Add option
      </Button>
    </div>
  )
}

export function OptionsEditor({
  options,
  onChange,
}: {
  options: string[]
  onChange: (options: string[]) => void
}) {
  return (
    <OptionRows
      rows={options.map((label, index) => ({ key: String(index), label }))}
      onRename={(index, label) =>
        onChange(options.map((o, i) => (i === index ? label : o)))
      }
      onRemove={(index) => onChange(options.filter((_, i) => i !== index))}
      onAdd={() => onChange([...options, ""])}
    />
  )
}

export function ChoiceOptionsEditor({
  options,
  onChange,
}: {
  options: ChoiceOption[]
  onChange: (options: ChoiceOption[]) => void
}) {
  return (
    <OptionRows
      rows={options.map((option) => ({ key: option.id, label: option.label }))}
      onRename={(index, label) =>
        onChange(options.map((o, i) => (i === index ? { ...o, label } : o)))
      }
      onRemove={(index) => onChange(options.filter((_, i) => i !== index))}
      onAdd={() =>
        onChange([...options, { id: crypto.randomUUID(), label: "" }])
      }
    />
  )
}
