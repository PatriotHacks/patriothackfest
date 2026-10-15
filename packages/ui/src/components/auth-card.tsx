import * as React from "react"
import { cn } from "cn"
import Image from "next/image"

import { PAPER, SERIF } from "@workspace/ui/lib/brand"

export function AuthCard({
  title,
  description,
  wide = false,
  children,
}: {
  title: string
  description: React.ReactNode
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        PAPER,
        "w-full px-[16.5px] pt-[25px] pb-[17.5px]",
        wide ? "max-w-[640px] sm:px-[32px] sm:pb-[28px]" : "max-w-[429px]"
      )}
    >
      <div className="flex flex-col items-center text-center">
        <Image
          src="/logo.png"
          alt="Patriot HackFest"
          width={400}
          height={211}
          preload
          className="h-[50.5px] w-auto"
        />
        <h1 className={cn(SERIF, "mt-[14px] text-[38.5px] leading-[1.05]")}>
          {title}
        </h1>
        <p className="mt-[11px] text-[14.5px] text-[#6E6E68]">{description}</p>
      </div>
      <div className="mt-[22px]">{children}</div>
    </div>
  )
}
