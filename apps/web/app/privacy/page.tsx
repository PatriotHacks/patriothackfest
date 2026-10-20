import type { Metadata } from "next"

import { LegalDocument } from "@/components/legal-document"
import { privacyPolicy } from "@/content/legal"
import { site } from "@/content/site"

export const metadata: Metadata = {
  title: `Privacy Policy | ${site.name}`,
  description: `How ${site.name} collects, uses, and shares personal information.`,
}

export default function PrivacyPage() {
  return <LegalDocument content={privacyPolicy} />
}
