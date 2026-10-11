"use server"

import { createClient } from "@workspace/supabase/server"
import { redirect } from "next/navigation"

import { AUTH_COOKIE } from "@/lib/auth-cookie"

export async function signOut() {
  const supabase = await createClient(AUTH_COOKIE)
  await supabase.auth.signOut()
  redirect("/login")
}
