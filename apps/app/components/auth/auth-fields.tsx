import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"

export function AuthForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form className={cn("flex flex-col gap-[6.5px]", className)} {...props} />
  )
}

export function AuthLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      className={cn(
        "text-[14px] font-semibold tracking-[0.16em] text-[#6E6E68] uppercase",
        className
      )}
      {...props}
    />
  )
}

export function AuthInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        "h-[52px] rounded-[8px] border-2 border-[#3A4A2B] bg-white px-[14px] text-[16.5px] text-[#2A2A26] placeholder:text-[#A3A39B] focus-visible:border-[#3A4A2B] focus-visible:ring-2 focus-visible:ring-[#3A4A2B]/20 md:text-[16.5px] dark:bg-white",
        className
      )}
      {...props}
    />
  )
}

export function AuthButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "mt-[27.5px] h-[48.5px] w-full rounded-full bg-[#3A4A2B] text-[16px] font-medium text-[#F8F7F2] hover:bg-[#3A4A2B]/90 focus-visible:ring-2 focus-visible:ring-[#3A4A2B]/30",
        className
      )}
      {...props}
    />
  )
}

export function AuthTextButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "text-[14px] text-[#3A4A2B] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-[#A3A39B] disabled:no-underline",
        className
      )}
      {...props}
    />
  )
}

export function AuthError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      role="alert"
      className={cn(
        "my-[5.5px] rounded-[8px] border border-destructive/20 bg-destructive/5 px-[14px] py-[10px] text-[14px] text-destructive",
        className
      )}
      {...props}
    />
  )
}
