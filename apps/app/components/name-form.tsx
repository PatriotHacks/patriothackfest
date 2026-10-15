"use client"

import {
  AuthButton,
  AuthError,
  AuthForm,
  AuthInput,
  AuthLabel,
} from "@workspace/ui/components/auth-fields"
import { useState, useTransition } from "react"

import { saveFullName } from "@/app/(applicant)/(card)/welcome/actions"

export function NameForm() {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <AuthForm
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
      <AuthButton type="submit" disabled={pending || name.trim() === ""}>
        Continue
      </AuthButton>
      {error && <AuthError id="full-name-error">{error}</AuthError>}
    </AuthForm>
  )
}
