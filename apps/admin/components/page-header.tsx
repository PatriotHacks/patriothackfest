import { SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

type Props = {
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
}

function Header({
  heading,
  description,
  children,
}: Omit<Props, "title"> & { heading: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-[6px]">
        {heading}
        {description && (
          <div className="text-[15px] text-muted-foreground">{description}</div>
        )}
      </div>
      {children && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}

export function PageHeader({ title, ...props }: Props) {
  return (
    <Header
      heading={
        <h1 className={cn(SERIF, "text-[40px] leading-[1.05]")}>{title}</h1>
      }
      {...props}
    />
  )
}

export function SectionHeader({ title, ...props }: Props) {
  return (
    <Header
      heading={
        <h2 className={cn(SERIF, "text-[30px] leading-[1.1]")}>{title}</h2>
      }
      {...props}
    />
  )
}
