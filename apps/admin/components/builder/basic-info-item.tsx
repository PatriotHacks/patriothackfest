import { Card, CardContent } from "@workspace/ui/components/card"
import { LockIcon } from "lucide-react"

export const BASIC_INFO_TITLE = "Basic Information"

export const BASIC_INFO_FIELDS = [
  { label: "Full name", type: "text" },
  { label: "Email", type: "email" },
  { label: "School", type: "text" },
  { label: "Phone number", type: "tel" },
  { label: "Date of birth", type: "date" },
] as const

export function BasicInfoItem() {
  return (
    <Card className="border-l-4 border-l-primary bg-muted/50">
      <CardContent className="flex gap-3">
        <LockIcon
          className="m-1 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Section 1</span>
            <span className="text-xs text-muted-foreground">
              Always first. Collected from every applicant and not editable.
            </span>
          </div>
          <p className="text-lg font-semibold">{BASIC_INFO_TITLE}</p>
          <p className="text-sm text-muted-foreground">
            {BASIC_INFO_FIELDS.map((f) => f.label).join(", ")}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
