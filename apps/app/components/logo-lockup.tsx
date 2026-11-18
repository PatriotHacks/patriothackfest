import { cn } from "@workspace/ui/lib/utils"
import Image from "next/image"

export const VIEW_LABELS = {
  participant: "Participant",
  judging: "Judging",
} as const

export type View = keyof typeof VIEW_LABELS

export function LogoLockup({
  view,
  imageClassName,
  preload,
}: {
  view: View
  imageClassName: string
  preload?: boolean
}) {
  return (
    <span className="flex items-center gap-3">
      <Image
        src="/logo.png"
        alt="Patriot HackFest"
        width={400}
        height={211}
        preload={preload}
        className={cn("w-auto", imageClassName)}
      />
      <span className="border-l border-[#E7E4D9] pl-3 font-(family-name:--font-auth-sans) text-sm font-medium whitespace-nowrap text-[#6E6E68]">
        {VIEW_LABELS[view]}
      </span>
    </span>
  )
}
