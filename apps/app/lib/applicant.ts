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
