import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { cookies } from "next/headers"

import { JudgeSidebar } from "@/components/judge-sidebar"
import { LogoLockup } from "@/components/logo-lockup"
import { getApplicant, getSubmittedApplications } from "@/lib/applicant"

export default async function JudgeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Authentication only: judges do not need an application or profile name.
  const { email } = await getApplicant()
  const applications = await getSubmittedApplications()
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <JudgeSidebar applicationId={applications[0]?.id} email={email} />
      <SidebarInset className="bg-white text-[#3A4A2B]">
        <header className="flex items-center gap-3 border-b border-[#E7E4D9] px-4 py-2 md:hidden">
          <SidebarTrigger />
          <LogoLockup view="judging" imageClassName="h-[32px]" />
        </header>
        <main className="flex w-full max-w-4xl flex-1 flex-col gap-5 p-4 has-data-wide:max-w-none sm:p-8 lg:px-12">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
