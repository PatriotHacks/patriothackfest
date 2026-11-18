import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { redirect } from "next/navigation"

import { ApplicantSidebar } from "@/components/applicant-sidebar"
import { LogoLockup } from "@/components/logo-lockup"
import { getNamedApplicant } from "@/lib/applicant"

export default async function MainLayout({ children }: LayoutProps<"/">) {
  const { supabase, userId, email } = await getNamedApplicant()

  const { data, error } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) redirect("/start")

  return (
    <SidebarProvider>
      <ApplicantSidebar applicationId={data.id} email={email} />
      <SidebarInset className="bg-white">
        <header className="flex items-center gap-3 border-b border-[#E7E4D9] px-4 py-2 md:hidden">
          <SidebarTrigger />
          <LogoLockup view="participant" imageClassName="h-[32px]" />
        </header>
        <main className="flex-1 p-4 sm:p-8 lg:px-12">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
