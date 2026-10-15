"use client"

import type { FieldType, Section } from "@workspace/forms"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import { useId } from "react"

import { ItemHeader } from "./question-editor"

type Props = {
  section: Section
  index: number
  typeLocked: boolean
  issues: string[]
  onChange: (section: Section) => void
  onTypeChange: (type: FieldType) => void
  onArchive: () => void
}

export function SectionEditor({
  section,
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
      <ItemHeader
        heading={`Section ${index + 1}`}
        type={section.type}
        typeLocked={typeLocked}
        onTypeChange={onTypeChange}
        onArchive={onArchive}
      />
      <Input
        id={`${id}-title`}
        aria-label="Section title"
        className={cn(SERIF, "h-11 text-[22px] md:text-[22px]")}
        value={section.label}
        placeholder="Section title"
        onChange={(e) => onChange({ ...section, label: e.target.value })}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-description`}>Description</Label>
        <Textarea
          id={`${id}-description`}
          value={section.help_text ?? ""}
          rows={2}
          onChange={(e) =>
            onChange({ ...section, help_text: e.target.value || null })
          }
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id={`${id}-editable`}
          checked={section.editable_after_submit}
          onCheckedChange={(editable_after_submit) =>
            onChange({ ...section, editable_after_submit })
          }
        />
        <Label htmlFor={`${id}-editable`}>Editable after submission</Label>
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
