"use client"

import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useRef } from "react"

type Props<V extends string> = {
  id: string
  value: string
  onChange: (value: string) => void
  maxLength: number
  variables: readonly V[]
  info: Record<V, string>
  className?: string
}

export function BodyField<V extends string>({
  id,
  value,
  onChange,
  maxLength,
  variables,
  info,
  className,
}: Props<V>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const focused = useRef(false)

  function insert(variable: V) {
    const el = ref.current
    if (!el) return
    const token = `{{${variable}}}`
    const start = focused.current ? el.selectionStart : value.length
    const end = focused.current ? el.selectionEnd : value.length
    const cursor = start + token.length
    onChange(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>Body</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Textarea
          id={id}
          ref={ref}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            focused.current = true
          }}
          className={cn("font-mono", className)}
        />
        <div
          role="group"
          aria-label="Insert variable"
          className="flex flex-wrap gap-1 sm:flex-col sm:flex-nowrap"
        >
          {variables.map((variable) => (
            <Button
              key={variable}
              type="button"
              variant="outline"
              size="sm"
              className="font-mono"
              title={info[variable]}
              onClick={() => insert(variable)}
            >
              {`{{${variable}}}`}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
