"use client"

import { useState, type ComponentProps } from "react"

import { FormInput } from "./form-controls"

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
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: unknown
  onValueChange: (value: number | string | undefined) => void
}) {
  const [text, setText] = useState(
    typeof value === "number" || typeof value === "string" ? String(value) : ""
  )

  return (
    <FormInput
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
