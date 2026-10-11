import { Button } from "@workspace/ui/components/button"
import { createClient } from "@workspace/supabase/server"
import { redirect } from "next/navigation"

import { signOut } from "@/lib/auth-actions"

export default async function AccessDeniedPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect("/login")

  const { data: level } = await supabase.rpc("current_admin_level")
  if (level) redirect("/")

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-muted-foreground">
        {data.claims.email} is not an admin, or this session was not signed in
        with Google.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  )
}
