"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

export function OptionsEditor({
  options,
  onChange,
}: {
  options: string[]
  onChange: (options: string[]) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Options</Label>
      {options.map((option, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={option}
            aria-label={`Option ${index + 1}`}
            onChange={(e) =>
              onChange(
                options.map((o, i) => (i === index ? e.target.value : o))
              )
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(options.filter((_, i) => i !== index))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...options, ""])}
      >
        Add option
      </Button>
    </div>
  )
}
