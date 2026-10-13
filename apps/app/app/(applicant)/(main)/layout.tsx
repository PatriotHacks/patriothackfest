import { Button } from "@workspace/ui/components/button"

import { getApplicant } from "@/lib/applicant"
import { signOut } from "@/lib/auth-actions"

export default async function MainLayout({ children }: LayoutProps<"/">) {
  const { email } = await getApplicant()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-6 border-b px-6 py-3">
        <span className="font-semibold">Patriot HackFest</span>
        <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
          <span>{email}</span>
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
