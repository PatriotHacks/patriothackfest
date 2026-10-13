"use client"

import { useState, useTransition } from "react"

import { saveFullName } from "@/app/(applicant)/(card)/welcome/actions"
import {
  AuthButton,
  AuthError,
  AuthInput,
  AuthLabel,
} from "@/components/auth/auth-fields"

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
      <AuthLabel htmlFor="full-name">Full name</AuthLabel>
      <AuthInput
        id="full-name"
        autoComplete="name"
        placeholder="Jane Doe"
        required
        autoFocus
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-invalid={error !== null}
        aria-describedby={error ? "full-name-error" : undefined}
        disabled={pending}
      />
      <AuthButton
        type="submit"
        className="mt-3"
        disabled={pending || name.trim() === ""}
      >
        Continue
      </AuthButton>
      {error && <AuthError id="full-name-error">{error}</AuthError>}
    </form>
  )
}
