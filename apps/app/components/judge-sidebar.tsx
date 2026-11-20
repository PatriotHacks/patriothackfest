"use client"

import {
  AwardIcon,
  ClipboardListIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"

export function JudgeSidebar({
  applicationId,
  email,
  eventSlug,
}: {
  applicationId?: string
  email: string
  eventSlug?: string
}) {
  const nav = [
    {
      href: "/judge",
      label: "Dashboard",
      icon: LayoutDashboardIcon,
      exact: true,
    },
    ...(eventSlug
      ? [
          {
            href: `/judge/${encodeURIComponent(eventSlug)}`,
            label: "Assignments",
            icon: ClipboardListIcon,
          },
        ]
      : []),
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
