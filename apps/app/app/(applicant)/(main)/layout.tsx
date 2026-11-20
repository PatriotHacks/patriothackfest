import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ApplicantSidebar } from "@/components/applicant-sidebar"
import { LogoLockup } from "@/components/logo-lockup"
import { getNamedApplicant, getSubmittedApplications } from "@/lib/applicant"
import { participantView } from "@/lib/participant-view"

export default async function MainLayout({ children }: LayoutProps<"/">) {
  const applications = await getSubmittedApplications()
  const latest = applications[0]
  if (!latest) redirect("/start")
  const { email } = await getNamedApplicant()
  const view = participantView(applications, Date.now())

  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <ApplicantSidebar applicationId={latest.id} email={email} view={view} />
      <SidebarInset className="bg-white">
        <header className="flex items-center gap-3 border-b border-[#E7E4D9] px-4 py-2 md:hidden">
          <SidebarTrigger />
          <LogoLockup view={view} imageClassName="h-[32px]" />
        </header>
        <main className="flex-1 p-4 sm:p-8 lg:px-12">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
