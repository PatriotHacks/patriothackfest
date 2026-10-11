"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"

const email = z.email().transform((e) => e.toLowerCase())
const level = z.enum(["owner", "organizer", "reviewer"])

function done(error: { message: string } | null): ActionResult {
  if (error) return failure(error)
  revalidatePath("/admins")
  return ok
}

export async function addAdmin(
  rawEmail: string,
  rawLevel: string
): Promise<ActionResult> {
  const parsed = email.safeParse(rawEmail.trim())
  if (!parsed.success) return { error: "Enter a valid email address" }
  const input = { email: parsed.data, level: level.parse(rawLevel) }
  const { supabase } = await requireAdmin("owner")

  const { error } = await supabase.from("admin_allowlist").insert(input)
  return done(error)
}

export async function updateAdminLevel(
  rawEmail: string,
  rawLevel: string
): Promise<ActionResult> {
  const target = email.parse(rawEmail)
  const newLevel = level.parse(rawLevel)
  const { supabase } = await requireAdmin("owner")

  const { error } = await supabase
    .from("admin_allowlist")
    .update({ level: newLevel })
    .eq("email", target)
  return done(error)
}

export async function removeAdmin(rawEmail: string): Promise<ActionResult> {
  const target = email.parse(rawEmail)
  const { supabase } = await requireAdmin("owner")

  const { error } = await supabase
    .from("admin_allowlist")
    .delete()
    .eq("email", target)
  return done(error)
}
