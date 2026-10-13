import { cn } from "@workspace/ui/lib/utils"
import Image from "next/image"

import { authSans, authSerif } from "@/lib/auth-fonts"

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        authSerif.variable,
        authSans.variable,
        "w-full max-w-[312px] rounded-[10px] border border-[#E7E4D9] bg-[#fef9ef] px-3 pt-[18px] pb-[13px] font-(family-name:--font-auth-sans) text-[#3A4A2B] shadow-[0_1px_2px_rgb(58_74_43/0.05),0_6px_16px_rgb(58_74_43/0.06)]"
      )}
    >
      <div className="flex flex-col items-center text-center">
        <Image
          src="/logo.png"
          alt="Patriot HackFest"
          width={400}
          height={211}
          preload
          className="h-[37px] w-auto"
        />
        <h1 className="mt-[10px] font-(family-name:--font-auth-serif) text-[28px] leading-[1.05] italic">
          {title}
        </h1>
        <p className="mt-2 text-[10.5px] text-[#6E6E68]">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}
