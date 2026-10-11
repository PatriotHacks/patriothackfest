"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Label } from "@workspace/ui/components/label"
import { useEffect, useState, useTransition } from "react"

import { sendCode, verifyCode } from "@/app/login/actions"

const RESEND_COOLDOWN_SECONDS = 60
const DIGITS_ONLY = "^\\d+$"

export function OtpLoginForm() {
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
      <form
        className="flex w-full max-w-sm flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error !== null}
          disabled={pending}
        />
        <Button type="submit" disabled={pending}>
          Email me a code
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    )
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        verify(code)
      }}
    >
      <p className="text-center text-sm text-muted-foreground">
        Enter the 6-digit code sent to {email}.
      </p>
      <InputOTP
        maxLength={6}
        pattern={DIGITS_ONLY}
        autoComplete="one-time-code"
        autoFocus
        value={code}
        onChange={(value) => {
          setCode(value)
          setError(null)
        }}
        onComplete={verify}
        disabled={pending}
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, i) => (
            <InputOTPSlot key={i} index={i} aria-invalid={error !== null} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <Button
        type="submit"
        className="w-full"
        disabled={pending || code.length !== 6}
      >
        Verify
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex w-full justify-between">
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={changeEmail}
          disabled={pending}
        >
          Use a different email
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={send}
          disabled={pending || cooldown > 0}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Button>
      </div>
    </form>
  )
}
