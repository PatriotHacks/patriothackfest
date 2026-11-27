import { MAIN_SITE_URL } from "@/lib/site"

const LINKS = [
  { href: MAIN_SITE_URL, label: "Main site" },
  { href: `${MAIN_SITE_URL}/#faq`, label: "FAQ" },
  { href: `${MAIN_SITE_URL}/privacy.html`, label: "Privacy Policy" },
  { href: `${MAIN_SITE_URL}/terms.html`, label: "Terms of Service" },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-[#E7E4D9] text-sm text-[#6E6E68]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <p className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-3">
          <span>&copy; 2026 Patriot HackFest</span>
          <span aria-hidden="true" className="hidden sm:inline">
            &middot;
          </span>
          <span>George Mason University, Fairfax, VA</span>
          <span aria-hidden="true" className="hidden sm:inline">
            &middot;
          </span>
          <a
            href="mailto:directors@patriothackfest.com"
            className="hover:text-[#3A4A2B] hover:underline"
          >
            directors@patriothackfest.com
          </a>
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="hover:text-[#3A4A2B] hover:underline"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
