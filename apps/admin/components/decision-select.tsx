"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { DECISION_LABELS, DECISIONS, type Decision } from "@/lib/roles"

export function DecisionSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: Decision | undefined
  onChange: (decision: Decision) => void
  disabled?: boolean
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as Decision)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-40">
        <SelectValue placeholder="Choose decision" />
      </SelectTrigger>
      <SelectContent>
        {DECISIONS.map((d) => (
          <SelectItem key={d} value={d}>
            {DECISION_LABELS[d]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
