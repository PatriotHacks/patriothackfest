import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

const CONTROL =
  "rounded-[8px] border-2 border-[#3A4A2B] bg-white px-[14px] text-[16px] text-[#2A2A26] outline-none placeholder:text-[#A3A39B] focus-visible:border-[#3A4A2B] focus-visible:ring-2 focus-visible:ring-[#3A4A2B]/20 disabled:cursor-not-allowed disabled:border-[#DAD7CC] disabled:bg-[#F1EFE8] disabled:text-[#8A8A82] disabled:opacity-100 aria-invalid:border-destructive md:text-[16px] dark:bg-white"

export const TILE =
  "flex cursor-pointer items-center gap-[12px] rounded-[11px] border-2 border-[#DAD7CC] bg-white px-[14px] py-[12px] text-[15.5px] text-[#2A2A26] transition-colors hover:border-[#3A4A2B]/60 has-disabled:cursor-not-allowed has-disabled:opacity-60 has-[[data-state=checked]]:border-[#3A4A2B] has-[[data-state=checked]]:bg-[#3A4A2B]/5"

export const OLIVE_CHECK =
  "size-[18px] border-2 border-[#3A4A2B] data-[state=checked]:border-[#3A4A2B] data-[state=checked]:bg-[#3A4A2B] data-[state=checked]:text-[#F8F7F2]"

export function FormInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input className={cn(CONTROL, "h-[48px] w-full", className)} {...props} />
  )
}

export function FormTextarea({
  className,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      className={cn(CONTROL, "min-h-[120px] py-[12px]", className)}
      {...props}
    />
  )
}

export function FormSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return <select className={cn(CONTROL, "h-[48px]", className)} {...props} />
}

export function QuestionLabel({
  required,
  children,
  ...props
}: React.ComponentProps<typeof Label> & { required?: boolean }) {
  return (
    <Label
      className="block text-[15.5px] leading-snug font-semibold text-[#3A4A2B]"
      {...props}
    >
      {children}
      {required && (
        <>
          <span className="text-destructive" aria-hidden>
            {" "}
            *
          </span>
          <span className="sr-only">(required)</span>
        </>
      )}
    </Label>
  )
}

export function FormHelp({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-[14px] whitespace-pre-wrap text-[#6E6E68]",
        className
      )}
      {...props}
    />
  )
}

export function FormFieldError(props: React.ComponentProps<"p">) {
  return <p className="text-[14px] text-destructive" {...props} />
}

export function SectionHeading({
  id,
  title,
  description,
}: {
  id?: string
  title: string
  description?: string | null
}) {
  return (
    <div className="flex flex-col gap-[4px]">
      <h2 id={id} className={cn(SERIF, "text-[28px] leading-[1.1]")}>
        {title}
      </h2>
      {description && <FormHelp>{description}</FormHelp>}
    </div>
  )
}

export function FormSection({
  muted = false,
  className,
  ...props
}: React.ComponentProps<"section"> & { muted?: boolean }) {
  return (
    <section
      className={cn(
        "flex flex-col gap-[18px] border-t border-[#E7E4D9] pt-[24px] first:border-t-0 first:pt-0",
        muted && "text-[#8A8A82]",
        className
      )}
      {...props}
    />
  )
}
