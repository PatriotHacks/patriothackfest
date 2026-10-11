import { redirect } from "next/navigation"

import { AdminsManager } from "@/components/admins-manager"
import { getAdmin } from "@/lib/admin"

export default async function AdminsPage() {
  const { supabase, level, email } = await getAdmin()
  if (level !== "owner") redirect("/forms")

  const { data, error } = await supabase
    .from("admin_allowlist")
    .select("email, level, created_at")
    .order("level")
    .order("email")
  if (error) throw new Error(error.message)

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Admins</h1>
      <AdminsManager admins={data} currentEmail={email} />
    </div>
  )
}
