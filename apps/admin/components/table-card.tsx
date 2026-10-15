import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

export function TableCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn("gap-0 py-1 *:data-[slot=table-container]:px-2", className)}
      {...props}
    />
  )
}
