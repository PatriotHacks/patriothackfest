import Link from "next/link"

import { PageHero, Sheet } from "@/components/page-hero"

export default function NotFound() {
  return (
    <>
      <PageHero eyebrow="404" title="Nothing to see here">
        <p className="max-w-[680px] text-[19px] leading-relaxed">
          This project or event isn&apos;t in the gallery.
        </p>
      </PageHero>
      <Sheet>
        <Link href="/" className="btn">
          Browse all projects
        </Link>
      </Sheet>
    </>
  )
}
