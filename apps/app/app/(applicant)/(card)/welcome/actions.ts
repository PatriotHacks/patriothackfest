"use server"

import { redirect } from "next/navigation"
import * as z from "zod"

import { failure, type ActionResult } from "@/lib/action-result"
import { getApplicant } from "@/lib/applicant"

const fullNameInput = z
  .string()
  .trim()
  .min(1, "Enter your name")
  .max(100, "Use 100 characters or fewer")

export async function saveFullName(name: string): Promise<ActionResult> {
  const parsed = fullNameInput.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0]!.message }
  const { supabase, userId } = await getApplicant()

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data })
    .eq("id", userId)
    .select("id")
  if (error) return failure(error)
  if (data.length === 0) return { error: "Profile not found" }

  redirect("/start")
}
