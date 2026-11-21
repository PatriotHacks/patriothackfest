"use client"

import {
  AwardIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"

export function JudgeSidebar({
  applicationId,
  email,
}: {
  applicationId?: string
  email: string
}) {
  const nav = [
    {
      href: "/judge",
      label: "Dashboard",
      icon: LayoutDashboardIcon,
      match: (path: string) =>
        /^\/judge(\/[^/]+(\/projects)?\/[^/]+)?$/.test(path),
    },
    { href: "/judge/rubric", label: "Rubric", icon: ListChecksIcon },
    { href: "/judge/certificate", label: "Certificate", icon: AwardIcon },
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
  return <AppSidebar email={email} homeHref="/judge" nav={nav} view="judging" />
}
