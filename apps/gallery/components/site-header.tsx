import Image from "next/image"
import Link from "next/link"

import { OUTLINE_PILL } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import { MAIN_SITE_URL } from "@/lib/site"

export function SiteHeader() {
  return (
    <header className="border-b border-[#E7E4D9]">
      <div className="mx-auto flex min-h-[74px] w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Patriot HackFest"
            width={400}
            height={211}
            preload
            className="h-[32px] w-auto sm:h-[42px]"
          />
          <span className="border-l border-[#E7E4D9] pl-3 text-sm font-medium whitespace-nowrap text-[#6E6E68]">
            Project Gallery
          </span>
        </Link>
        <a
          href={MAIN_SITE_URL}
          className={cn(
            OUTLINE_PILL,
            "inline-flex h-9 items-center px-4 text-[14px] sm:h-[40px] sm:px-[18px] sm:text-[14.5px]"
          )}
        >
          Main site
        </a>
      </div>
    </header>
  )
}
