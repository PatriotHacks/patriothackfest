import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ApplicantSidebar } from "@/components/applicant-sidebar"
import { JudgeSidebar } from "@/components/judge-sidebar"
import { LogoLockup } from "@/components/logo-lockup"
import { getNamedApplicant, getSubmittedApplications } from "@/lib/applicant"
import { getJudgeEvents } from "@/lib/judge-access"
import { allJudgingClosed } from "@/lib/judge-status"
import { participantView } from "@/lib/participant-view"

// Judging takes priority: judges keep the judge shell while viewing their application.
export default async function MainLayout({ children }: LayoutProps<"/">) {
  const events = await getJudgeEvents()
  const judging = events.length > 0
  const applications = await getSubmittedApplications()
  const latest = applications[0]
  if (!latest) redirect(judging ? "/judge" : "/start")
  const { email } = await getNamedApplicant()
  const view = judging ? "judging" : participantView(applications, Date.now())

  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      {view === "judging" ? (
        <JudgeSidebar
          applicationId={latest.id}
          email={email}
          judgingClosed={allJudgingClosed(events)}
        />
      ) : (
        <ApplicantSidebar applicationId={latest.id} email={email} view={view} />
      )}
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
