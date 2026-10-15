import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const pillVariants = cva("inline-block rounded-full font-medium", {
  variants: {
    tone: {
      olive: "bg-[#3A4A2B] text-[#F8F7F2]",
      sage: "bg-[#3A4A2B]/10 text-[#3A4A2B]",
      amber: "bg-[#F4E7C7] text-[#7A5A14]",
      brick: "bg-[#F5DED6] text-[#8E3B26]",
      outline: "text-[#3A4A2B] ring-1 ring-[#3A4A2B]/35 ring-inset",
      muted: "bg-[#EEECE5] text-[#6E6E68]",
    },
    size: {
      default: "px-[12px] py-[4px] text-[13px]",
      sm: "px-[9px] py-[2px] text-[12px]",
    },
  },
  defaultVariants: {
    tone: "olive",
    size: "default",
  },
})

function Pill({
  className,
  tone,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof pillVariants>) {
  return (
    <span
      data-slot="pill"
      className={cn(pillVariants({ tone, size }), className)}
      {...props}
    />
  )
}

export { Pill, pillVariants }
