"use client"

import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  isChoiceType,
  type Field,
  type FieldType,
  type Question,
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

import { EYEBROW } from "@/lib/styles"

import { ConditionEditor } from "./condition-editor"
import { OptionsEditor } from "./options-editor"
import { ValidationEditor } from "./validation-editor"

type Props = {
  field: Question
  index: number
  typeLocked: boolean
  conditionSources: Field[]
  issues: string[]
  onChange: (field: Field) => void
  onTypeChange: (type: FieldType) => void
  onArchive: () => void
}

export function ItemHeader({
  heading,
  type,
  typeLocked,
  onTypeChange,
  onArchive,
}: {
  heading: string
  type: FieldType
  typeLocked: boolean
  onTypeChange: (type: FieldType) => void
  onArchive: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={EYEBROW}>{heading}</span>
      <Select
        value={type}
        onValueChange={(value) => onTypeChange(value as FieldType)}
        disabled={typeLocked}
      >
        <SelectTrigger size="sm" aria-label="Item type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIELD_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {FIELD_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {typeLocked && (
        <span className="text-xs text-muted-foreground">
          Type locked: this question has answers
        </span>
      )}
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onArchive}>
        Delete
      </Button>
    </div>
  )
}

export function QuestionEditor({
  field,
  index,
  typeLocked,
  conditionSources,
  issues,
  onChange,
  onTypeChange,
  onArchive,
}: Props) {
  const id = useId()

  return (
    <div className="flex flex-col gap-3">
      <ItemHeader
        heading={`Question ${index + 1}`}
        type={field.type}
        typeLocked={typeLocked}
        onTypeChange={onTypeChange}
        onArchive={onArchive}
      />
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
      {isChoiceType(field.type) && (
        <OptionsEditor
          options={field.options ?? []}
          onChange={(options) => onChange({ ...field, options } as Field)}
        />
      )}
      <ValidationEditor field={field} onChange={onChange} />
      <ConditionEditor
        field={field}
        sources={conditionSources}
        onChange={onChange}
      />
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
