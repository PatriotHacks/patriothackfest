import { Card, CardContent } from "@workspace/ui/components/card"
import { SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import { LockIcon } from "lucide-react"

import { EYEBROW } from "@/lib/styles"

export const BASIC_INFO_TITLE = "Basic Information"

export const BASIC_INFO_FIELDS = [
  { label: "Full name", type: "text", required: true },
  { label: "Email", type: "email", required: false },
  { label: "School", type: "text", required: true },
  { label: "Phone number", type: "tel", required: true },
  { label: "Date of birth", type: "date", required: true },
] as const

export function BasicInfoItem() {
  return (
    <Card className="bg-secondary">
      <CardContent className="flex gap-3">
        <LockIcon
          className="m-1 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={EYEBROW}>Section 1</span>
            <span className="text-xs text-muted-foreground">
              Always first. Collected from every applicant and not editable.
            </span>
          </div>
          <p className={cn(SERIF, "text-[26px] leading-[1.1]")}>
            {BASIC_INFO_TITLE}
          </p>
          <p className="text-sm text-muted-foreground">
            {BASIC_INFO_FIELDS.map((f) => f.label).join(", ")}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
