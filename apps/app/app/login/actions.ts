"use server"

import { createClient } from "@workspace/supabase/server"
import { redirect } from "next/navigation"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { AUTH_COOKIE } from "@/lib/auth-cookie"

const emailInput = z.email().trim().toLowerCase()
const codeInput = z.string().regex(/^\d{6}$/)

export async function sendCode(email: string): Promise<ActionResult> {
  const parsed = emailInput.safeParse(email)
  if (!parsed.success) return { error: "Enter a valid email address." }

  const supabase = await createClient(AUTH_COOKIE)
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true },
  })
  if (error) return failure(error)

  return ok
}

export async function verifyCode(
  email: string,
  code: string
): Promise<ActionResult> {
  const parsedEmail = emailInput.safeParse(email)
  const parsedCode = codeInput.safeParse(code)
  if (!parsedEmail.success || !parsedCode.success) {
    return { error: "Enter the 6-digit code from your email." }
  }

  const supabase = await createClient(AUTH_COOKIE)
  const { error } = await supabase.auth.verifyOtp({
    email: parsedEmail.data,
    token: parsedCode.data,
    type: "email",
  })
  if (error) return failure(error)

  redirect("/")
}
