import "server-only"

import { createClient, type ServerClient } from "@workspace/supabase/server"
import { redirect } from "next/navigation"
import { cache } from "react"

import { AUTH_COOKIE } from "./auth-cookie"
import { isOtpSession } from "./otp-session"

type Applicant = { supabase: ServerClient; userId: string; email: string }

export const getApplicant = cache(async (): Promise<Applicant> => {
  const supabase = await createClient(AUTH_COOKIE)
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect("/login")

  const { claims } = data
  if (!isOtpSession(claims)) redirect("/login?error=session")
  if (!claims.email) throw new Error("Session is missing an email claim")

  return { supabase, userId: claims.sub, email: claims.email }
})

export const getFullName = cache(async () => {
  const { supabase, userId } = await getApplicant()
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single()
  if (error) throw new Error(error.message)
  return data.full_name?.trim() || null
})

export async function getNamedApplicant() {
  const applicant = await getApplicant()
  const fullName = await getFullName()
  if (!fullName) redirect("/welcome")
  return { ...applicant, fullName }
}
