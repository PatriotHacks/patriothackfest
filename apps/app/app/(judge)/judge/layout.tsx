import { Button } from "@workspace/ui/components/button"
import Link from "next/link"

import { LogoLockup } from "@/components/logo-lockup"
import { getApplicant } from "@/lib/applicant"
import { signOut } from "@/lib/auth-actions"

export default async function JudgeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Authentication only: judges do not need an application or profile name.
  const { email } = await getApplicant()
  return (
    <div className="min-h-svh bg-white text-[#3A4A2B]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E4D9] px-4 py-4 sm:px-8">
        <Link href="/judge" className="w-fit">
          <LogoLockup view="judging" imageClassName="h-[42px]" />
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm break-all text-[#6E6E68]">{email}</span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:p-8">
        {children}
      </main>
    </div>
  )
}
