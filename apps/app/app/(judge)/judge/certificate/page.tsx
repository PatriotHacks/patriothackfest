import { SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

export default function JudgeCertificatePage() {
  return (
    <>
      <h1 className={cn(SERIF, "text-4xl")}>Certificate</h1>
      <p className="text-sm text-[#6E6E68]">
        Your certificate will be available after you complete your judging
        assignments.
      </p>
    </>
  )
}
