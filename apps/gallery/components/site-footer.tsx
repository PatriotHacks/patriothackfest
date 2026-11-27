import Image from "next/image"

import { MAIN_SITE_URL } from "@/lib/site"

const LINKS = [
  { href: MAIN_SITE_URL, label: "Main site" },
  { href: `${MAIN_SITE_URL}/#faq`, label: "FAQ" },
  { href: `${MAIN_SITE_URL}/privacy.html`, label: "Privacy Policy" },
  { href: `${MAIN_SITE_URL}/terms.html`, label: "Terms of Service" },
]

export function SiteFooter() {
  return (
    <footer className="bg-bg relative z-[2] text-white">
      <div className="mx-auto flex w-[min(1080px,100%-32px)] items-start justify-between gap-8 pt-12 pb-14 max-[899px]:flex-col max-[899px]:gap-7 max-[899px]:pt-10 max-[899px]:pb-11">
        <div className="grid gap-[18px]">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt=""
              width={400}
              height={211}
              className="h-auto w-16 brightness-0 invert"
            />
            <p className="flex flex-col text-[22px] leading-tight font-bold tracking-[-0.01em]">
              Patriot HackFest
              <span className="text-[13px] font-medium tracking-[0.02em] text-[#9a9a9a]">
                Project Gallery
              </span>
            </p>
          </div>
          <p className="grid gap-1.5 text-[15px] text-[#a3a3a3]">
            &copy; 2026 Patriot HackFest
            <a
              href="mailto:directors@patriothackfest.com"
              className="no-underline hover:text-white hover:underline hover:underline-offset-[3px] max-[720px]:inline-flex max-[720px]:min-h-11 max-[720px]:items-center"
            >
              directors@patriothackfest.com
            </a>
          </p>
        </div>
        <div className="grid justify-items-end gap-7 max-[899px]:justify-items-start max-[899px]:gap-5">
          <nav
            aria-label="Footer"
            className="flex flex-wrap justify-end gap-x-6 gap-y-2.5 max-[899px]:justify-start max-[899px]:gap-x-5"
          >
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[15px] font-medium text-[#f2f2f2] no-underline hover:text-white hover:underline hover:underline-offset-[3px] max-[720px]:inline-flex max-[720px]:min-h-11 max-[720px]:items-center"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <address className="text-right text-[15px] leading-relaxed text-[#a3a3a3] not-italic max-[899px]:text-left">
            George Mason University
            <br />
            Fairfax, VA 22030
          </address>
        </div>
      </div>
    </footer>
  )
}
