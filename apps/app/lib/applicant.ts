import "server-only"

import { createClient, type ServerClient } from "@workspace/supabase/server"
import { redirect } from "next/navigation"
import { cache } from "react"

import { AUTH_COOKIE } from "./auth-cookie"

type Applicant = { supabase: ServerClient; userId: string; email: string }

export const getApplicant = cache(async (): Promise<Applicant> => {
  const supabase = await createClient(AUTH_COOKIE)
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect("/login")

  const viaOtp = data.claims.amr?.some(
    (entry) => typeof entry !== "string" && entry.method === "otp"
  )
  if (!viaOtp) {
    await supabase.auth.signOut({ scope: "local" })
    redirect("/login?error=session")
  }

  return { supabase, userId: data.claims.sub, email: data.claims.email ?? "" }
})
