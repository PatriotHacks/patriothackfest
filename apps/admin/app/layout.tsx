import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { brandFontVariables } from "@workspace/ui/lib/fonts"
import { cn } from "@workspace/ui/lib/utils"

const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Patriot HackFest Admin",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "theme-olive font-sans antialiased",
        geistMono.variable,
        brandFontVariables
      )}
    >
      <body>{children}</body>
    </html>
  )
}
