import Link from "next/link"

import { site } from "@/content/site"

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>{site.name}</p>
        <nav aria-label="Legal" className="flex gap-4">
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Terms of Use
          </Link>
        </nav>
        {site.contactEmail ? (
          <p>
            Contact:{" "}
            <a
              href={`mailto:${site.contactEmail}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {site.contactEmail}
            </a>
          </p>
        ) : (
          <p>Contact email coming soon</p>
        )}
      </div>
    </footer>
  )
}
