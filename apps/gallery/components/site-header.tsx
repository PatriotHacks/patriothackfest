import Image from "next/image"
import Link from "next/link"

import { MAIN_SITE_URL } from "@/lib/site"

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-10">
      <div className="mx-auto flex w-[min(1000px,100%-32px)] items-center gap-8 pt-3.5 min-[721px]:w-[min(1000px,100%-96px)] min-[721px]:pt-5 min-[900px]:grid min-[900px]:grid-cols-[1fr_auto_1fr]">
        <a
          href={MAIN_SITE_URL}
          aria-label="Patriot HackFest home"
          className="inline-block justify-self-start py-1 transition-transform hover:scale-[1.04] hover:rotate-1"
        >
          <Image
            src="/logo.png"
            alt="Patriot HackFest"
            width={400}
            height={211}
            priority
            className="h-auto w-16 brightness-0 invert"
          />
        </a>
        <nav
          aria-label="Site"
          className="nav-pill justify-self-center max-[720px]:hidden"
        >
          <Link href="/">Projects</Link>
          <a href={`${MAIN_SITE_URL}/#about`}>About</a>
          <a href={`${MAIN_SITE_URL}/#timeline`}>Timeline</a>
          <a href={`${MAIN_SITE_URL}/#faq`}>FAQ</a>
        </nav>
        <a
          href={MAIN_SITE_URL}
          className="btn ml-auto justify-self-end min-[900px]:ml-0"
        >
          Main site
        </a>
      </div>
    </header>
  )
}
