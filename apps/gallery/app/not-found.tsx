import Link from "next/link"

import { OUTLINE_PILL, PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import { PageHeader } from "@/components/page-header"

export default function NotFound() {
  return (
    <>
      <PageHeader title="Nothing to see here" />
      <section
        className={cn(
          PAPER,
          "flex max-w-[720px] flex-col items-start gap-4 p-6"
        )}
      >
        <p>This project or event isn&apos;t in the gallery.</p>
        <Link
          href="/"
          className={cn(
            OUTLINE_PILL,
            "inline-flex items-center justify-center"
          )}
        >
          Browse all projects
        </Link>
      </section>
    </>
  )
}
