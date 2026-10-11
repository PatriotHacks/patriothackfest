"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useState, useTransition } from "react"

import { saveFullName } from "@/app/(applicant)/welcome/actions"

export function NameForm() {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const result = await saveFullName(name)
          setError(result.error)
        })
      }}
    >
      <Label htmlFor="full-name">Full name</Label>
      <Input
        id="full-name"
        autoComplete="name"
        required
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-invalid={error !== null}
        aria-describedby={error ? "full-name-error" : undefined}
        disabled={pending}
      />
      <Button type="submit" disabled={pending || name.trim() === ""}>
        Continue
      </Button>
      {error && (
        <p id="full-name-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
