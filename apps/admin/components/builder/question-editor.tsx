"use client"

import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  type Field,
  type FieldType,
} from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { useId } from "react"

type Props = {
  field: Field
  index: number
  typeLocked: boolean
  issues: string[]
  onChange: (field: Field) => void
  onTypeChange: (type: FieldType) => void
  onArchive: () => void
}

export function QuestionEditor({
  field,
  index,
  typeLocked,
  issues,
  onChange,
  onTypeChange,
  onArchive,
}: Props) {
  const id = useId()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Question {index + 1}</span>
        <Select
          value={field.type}
          onValueChange={(value) => onTypeChange(value as FieldType)}
          disabled={typeLocked}
        >
          <SelectTrigger size="sm" aria-label="Question type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {FIELD_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {typeLocked && (
          <span className="text-xs text-muted-foreground">
            Type locked: this question has answers
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={onArchive}
        >
          Delete
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-label`}>Label</Label>
        <Input
          id={`${id}-label`}
          value={field.label}
          placeholder="Question label"
          onChange={(e) => onChange({ ...field, label: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-help`}>Help text</Label>
        <Textarea
          id={`${id}-help`}
          value={field.help_text ?? ""}
          rows={2}
          onChange={(e) =>
            onChange({ ...field, help_text: e.target.value || null })
          }
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id={`${id}-required`}
          checked={field.required}
          onCheckedChange={(required) => onChange({ ...field, required })}
        />
        <Label htmlFor={`${id}-required`}>Required</Label>
      </div>
      {issues.length > 0 && (
        <ul className="text-sm text-destructive">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
