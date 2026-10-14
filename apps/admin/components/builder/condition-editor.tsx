"use client"

import {
  conditionOperatorFor,
  type Field,
  type Question,
} from "@workspace/forms"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

const ALWAYS = "always"

function defaultValue(source: Field) {
  return source.type === "checkbox" ? true : (source.options?.[0] ?? "")
}

export function ConditionEditor({
  field,
  sources,
  onChange,
}: {
  field: Question
  sources: Field[]
  onChange: (field: Field) => void
}) {
  const condition = field.condition
  const source = condition
    ? sources.find((s) => s.id === condition.field_id)
    : undefined

  return (
    <div className="flex flex-col gap-2">
      <Label>Show this question</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={condition ? (source ? condition.field_id : "") : ALWAYS}
          onValueChange={(value) => {
            const next = sources.find((s) => s.id === value)
            onChange({
              ...field,
              condition: next
                ? {
                    field_id: next.id,
                    operator: conditionOperatorFor(next),
                    value: defaultValue(next),
                  }
                : null,
            })
          }}
        >
          <SelectTrigger aria-label="Condition question">
            <SelectValue placeholder="Depends on a question that is not earlier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALWAYS}>Always</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                When {s.label || "Untitled question"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {condition && source && (
          <>
            <span className="text-sm">{condition.operator}</span>
            <Select
              value={String(condition.value)}
              onValueChange={(value) =>
                onChange({
                  ...field,
                  condition: {
                    ...condition,
                    value:
                      source.type === "checkbox" ? value === "true" : value,
                  },
                })
              }
            >
              <SelectTrigger aria-label="Condition value">
                <SelectValue placeholder="Choose a value" />
              </SelectTrigger>
              <SelectContent>
                {source.type === "checkbox" ? (
                  <>
                    <SelectItem value="true">Checked</SelectItem>
                    <SelectItem value="false">Unchecked</SelectItem>
                  </>
                ) : (
                  (source.options ?? [])
                    .filter((o) => o !== "")
                    .map((o, i) => (
                      <SelectItem key={`${i}-${o}`} value={o}>
                        {o}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
    </div>
  )
}
