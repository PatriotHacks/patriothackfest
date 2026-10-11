import "server-only"

import { createClient, type ServerClient } from "@workspace/supabase/server"
import { redirect } from "next/navigation"
import { cache } from "react"

import { hasLevel, type AdminLevel } from "./levels"

type Admin = { supabase: ServerClient; email: string; level: AdminLevel }

export const getAdmin = cache(async (): Promise<Admin> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect("/login")

  const { data: level, error } = await supabase.rpc("current_admin_level")
  if (error) throw new Error(error.message)
  if (!level) redirect("/access-denied")

  return { supabase, email: data.claims.email ?? "", level }
})

export async function requireAdmin(min: AdminLevel): Promise<Admin> {
  const admin = await getAdmin()
  if (!hasLevel(admin.level, min)) throw new Error("Forbidden")
  return admin
}
