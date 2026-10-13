"use client"

import { useEffect, useState, useTransition } from "react"

import { sendCode, verifyCode } from "@/app/login/actions"
import { AuthCard } from "@/components/auth/auth-card"
import {
  AuthButton,
  AuthError,
  AuthInput,
  AuthLabel,
  AuthTextButton,
} from "@/components/auth/auth-fields"

const RESEND_COOLDOWN_SECONDS = 60
const CODE_LENGTH = 6

export function OtpLoginForm({ sessionEnded }: { sessionEnded: boolean }) {
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"email" | "code">("email")
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (cooldown === 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  function send() {
    setError(null)
    startTransition(async () => {
      const result = await sendCode(email)
      setError(result.error)
      if (result.error) return
      setStep("code")
      setCode("")
      setCooldown(RESEND_COOLDOWN_SECONDS)
    })
  }

  function verify(value: string) {
    setError(null)
    startTransition(async () => {
      const result = await verifyCode(email, value)
      setError(result.error)
      if (result.error) setCode("")
    })
  }

  function changeEmail() {
    setStep("email")
    setCode("")
    setError(null)
  }

  if (step === "email") {
    return (
      <AuthCard
        title="Sign in"
        description="Enter your email to receive a one-time code."
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          {sessionEnded && !error && (
            <AuthError>
              Your session has ended. Please sign in again with an email code.
            </AuthError>
          )}
          <AuthLabel htmlFor="email">Email</AuthLabel>
          <AuthInput
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? "email-error" : undefined}
            disabled={pending}
          />
          <AuthButton type="submit" className="mt-3" disabled={pending}>
            Send code
          </AuthButton>
          {error && <AuthError id="email-error">{error}</AuthError>}
        </form>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Check your email"
      description={
        <>
          We sent a 6-digit code to{" "}
          <span className="font-medium text-[#3A4A2B]">{email}</span>.
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          verify(code)
        }}
      >
        <AuthLabel htmlFor="code">Code</AuthLabel>
        <AuthInput
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={CODE_LENGTH}
          placeholder="123456"
          autoFocus
          className="text-center text-2xl tracking-[0.5em] md:text-2xl"
          value={code}
          onChange={(e) => {
            const value = e.target.value
              .replace(/\D/g, "")
              .slice(0, CODE_LENGTH)
            setCode(value)
            setError(null)
            if (value.length === CODE_LENGTH) verify(value)
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? "code-error" : undefined}
          disabled={pending}
        />
        <AuthButton
          type="submit"
          className="mt-3"
          disabled={pending || code.length !== CODE_LENGTH}
        >
          Verify
        </AuthButton>
        {error && <AuthError id="code-error">{error}</AuthError>}
        <div className="mt-2 flex flex-wrap justify-between gap-2">
          <AuthTextButton onClick={changeEmail} disabled={pending}>
            Use a different email
          </AuthTextButton>
          <AuthTextButton onClick={send} disabled={pending || cooldown > 0}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </AuthTextButton>
        </div>
      </form>
    </AuthCard>
  )
}
