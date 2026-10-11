"use client"

import { Button } from "@workspace/ui/components/button"
import { createClient } from "@workspace/supabase/client"
import { useState } from "react"

import { AUTH_COOKIE } from "@/lib/auth-cookie"

export function GoogleSignInButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setPending(true)
    setError(null)
    const { error } = await createClient(AUTH_COOKIE).auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={signIn} disabled={pending}>
        Sign in with Google
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
