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
        "w-full max-w-[468px] rounded-[15px] border border-[#E7E4D9] bg-[#fef9ef] px-[18px] pt-[27px] pb-[19.5px] font-(family-name:--font-auth-sans) text-[#3A4A2B] shadow-[0_1px_2px_rgb(58_74_43/0.05),0_9px_24px_rgb(58_74_43/0.06)]"
      )}
    >
      <div className="flex flex-col items-center text-center">
        <Image
          src="/logo.png"
          alt="Patriot HackFest"
          width={400}
          height={211}
          preload
          className="h-[55.5px] w-auto"
        />
        <h1 className="mt-[15px] font-(family-name:--font-auth-serif) text-[42px] leading-[1.05] italic">
          {title}
        </h1>
        <p className="mt-3 text-[16px] text-[#6E6E68]">{description}</p>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  )
}
