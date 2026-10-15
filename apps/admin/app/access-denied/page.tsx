import { AuthCard } from "@workspace/ui/components/auth-card"
import { Button } from "@workspace/ui/components/button"
import { createClient } from "@workspace/supabase/server"
import { redirect } from "next/navigation"

import { AUTH_COOKIE } from "@/lib/auth-cookie"
import { signOut } from "@/lib/auth-actions"

export default async function AccessDeniedPage() {
  const supabase = await createClient(AUTH_COOKIE)
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect("/login")

  const { data: level } = await supabase.rpc("current_admin_level")
  if (level) redirect("/")

  return (
    <main className="flex min-h-svh items-center justify-center bg-white p-4 sm:p-6">
      <AuthCard
        title="Access denied"
        description={`${data.claims.email} is not an admin, or this session was not signed in with Google.`}
      >
        <form action={signOut}>
          <Button type="submit" variant="outline" size="lg" className="w-full">
            Sign out
          </Button>
        </form>
      </AuthCard>
    </main>
  )
}
