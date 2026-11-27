import { SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

export function PageHeader({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <h1 className={cn(SERIF, "text-[40px] leading-[1.05] break-words")}>
        {title}
      </h1>
      {children}
    </div>
  )
}
