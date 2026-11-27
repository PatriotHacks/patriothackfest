import { PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

export function JudgingClosedNotice({ title }: { title?: string }) {
  return (
    <section className={cn(PAPER, "flex flex-col gap-3 p-6")}>
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      <p>
        Judging has closed. Thank you for judging! Your certificate is available
        on the{" "}
        <Link className="underline" href="/judge/certificate">
          Certificate page
        </Link>
        .
      </p>
    </section>
  )
}
