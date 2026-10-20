import type { Metadata } from "next"

import { LegalDocument } from "@/components/legal-document"
import { termsOfUse } from "@/content/legal"
import { site } from "@/content/site"

export const metadata: Metadata = {
  title: `Terms of Use | ${site.name}`,
  description: `The terms for using the ${site.name} website and applicant portal.`,
}

export default function TermsPage() {
  return <LegalDocument content={termsOfUse} />
}
