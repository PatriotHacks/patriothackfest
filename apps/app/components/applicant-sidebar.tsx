"use client"

import { FileTextIcon, FolderOpenIcon, LayoutDashboardIcon } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"

export function ApplicantSidebar({
  applicationId,
  email,
  view,
}: {
  applicationId?: string
  email: string
  view: "participant" | "mentor"
}) {
  const nav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
    { href: "/projects", label: "Project Submission", icon: FolderOpenIcon },
    ...(applicationId
      ? [
          {
            href: `/applications/${applicationId}`,
            label: "My application",
            icon: FileTextIcon,
          },
        ]
      : []),
  ]
  return <AppSidebar email={email} homeHref="/" nav={nav} view={view} />
}
