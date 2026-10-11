"use client"

import { Input } from "@workspace/ui/components/input"
import { useState, type ComponentProps } from "react"

const DECIMAL = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/

function parse(text: string) {
  const trimmed = text.trim()
  if (trimmed === "") return undefined
  const value = Number(trimmed)
  return DECIMAL.test(trimmed) && Number.isFinite(value) ? value : trimmed
}

export function NumberInput({
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: unknown
  onValueChange: (value: number | string | undefined) => void
}) {
  const [text, setText] = useState(
    typeof value === "number" || typeof value === "string" ? String(value) : ""
  )

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onValueChange(parse(e.target.value))
      }}
    />
  )
}
