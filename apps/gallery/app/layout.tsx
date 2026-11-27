import type { Metadata } from "next"

import { brandFontVariables } from "@workspace/ui/lib/fonts"
import { cn } from "@workspace/ui/lib/utils"

import "./globals.css"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { SITE_NAME, SITE_URL } from "@/lib/site"

const description =
  "Explore the projects built at Patriot HackFest, George Mason University's premier hackathon."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    title: SITE_NAME,
    description,
    url: "/",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn("antialiased", brandFontVariables)}>
      <body className="flex min-h-svh flex-col bg-white font-(family-name:--font-auth-sans) text-[#3A4A2B]">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
