import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { ApplicantSidebar } from "@/components/applicant-sidebar"
import { LogoLockup } from "@/components/logo-lockup"
import { getApplicant, getSubmittedApplications } from "@/lib/applicant"
import { participantView } from "@/lib/participant-view"

// Unlike the admissions layout, projects do not require the latest application
// to be non-draft or a profile name. Database RPCs authorize the specific event.
export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { email } = await getApplicant()
  const applications = await getSubmittedApplications()
  const view = participantView(applications, Date.now())
  return (
    <SidebarProvider>
      <ApplicantSidebar
        applicationId={applications[0]?.id}
        email={email}
        view={view}
      />
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
