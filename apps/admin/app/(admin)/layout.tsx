import { Button } from "@workspace/ui/components/button"
import Link from "next/link"

import { getAdmin } from "@/lib/admin"
import { signOut } from "@/lib/auth-actions"

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { email, level } = await getAdmin()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-6 border-b px-6 py-3">
        <span className="font-semibold">HackFest Admin</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/forms">Forms</Link>
          <Link href="/applications">Applications</Link>
          {level === "owner" && <Link href="/admins">Admins</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {email} ({level})
          </span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
