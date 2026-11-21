"use client"

import { Button } from "@workspace/ui/components/button"
import { PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { acknowledgeBriefing } from "@/app/(judge)/judge/actions"

export function BriefingReader({
  eventSlug,
  acknowledged,
  children,
}: {
  eventSlug: string
  acknowledged: boolean
  children: React.ReactNode
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const [read, setRead] = useState(acknowledged)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (read) return
    // Content that fits without scrolling intersects immediately and counts as read.
    const observer = new IntersectionObserver(
      ([entry]) => entry?.isIntersecting && setRead(true),
      { root: scroller.current }
    )
    observer.observe(end.current!)
    return () => observer.disconnect()
  }, [read])

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={scroller}
        tabIndex={0}
        aria-label="Judging briefing"
        className={cn(PAPER, "max-h-[65svh] overflow-y-auto p-6")}
      >
        {children}
        <div ref={end} aria-hidden className="h-px" />
      </div>
      {read ? (
        <Button
          type="button"
          className="w-fit"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null)
              try {
                const result = await acknowledgeBriefing(eventSlug)
                if (result.error || !result.href) {
                  setError(result.error ?? "Could not continue. Try again.")
                  return
                }
                router.push(result.href)
              } catch {
                setError("Could not continue. Try again.")
              }
            })
          }
        >
          {pending ? "Continuing…" : "Continue to judging"}
        </Button>
      ) : (
        <p className="text-sm text-[#6E6E68]">
          Scroll to the end of the briefing to continue.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
