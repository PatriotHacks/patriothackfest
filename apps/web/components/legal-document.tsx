import Link from "next/link"

import { SiteFooter } from "@/components/site-footer"
import type { LegalDocument as Content } from "@/content/legal"

export function LegalDocument({ content }: { content: Content }) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-4">
          <Link
            href="/"
            className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Back to home
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight">
            {content.title}
          </h1>
          {content.intro.map((paragraph) => (
            <p key={paragraph} className="text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </header>
        {content.sections.map((section) => (
          <section
            key={section.heading}
            aria-labelledby={slug(section.heading)}
            className="flex flex-col gap-4"
          >
            <h2 id={slug(section.heading)} className="text-xl font-semibold">
              {section.heading}
            </h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="text-muted-foreground">
                {paragraph}
              </p>
            ))}
            {section.items && (
              <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  )
}

function slug(heading: string) {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}
