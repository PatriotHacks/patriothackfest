import { cn } from "@workspace/ui/lib/utils"

export function FormError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-[8px] border border-destructive/20 bg-destructive/5 px-[14px] py-[10px] text-[14px] text-destructive",
        className
      )}
      {...props}
    />
  )
}
