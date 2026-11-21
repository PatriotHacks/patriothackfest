"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { usePathname, useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { acknowledgeBriefing } from "@/app/(judge)/judge/actions"

export function BriefingReader({
  eventSlug,
  children,
}: {
  eventSlug: string
  children: React.ReactNode
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) router.replace(pathname, { scroll: false })
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[85svh] flex-col gap-0 overflow-hidden rounded-sm bg-white p-0 text-base text-[#3A4A2B] sm:max-w-3xl"
      >
        <DialogTitle className="sr-only">Build scenario</DialogTitle>
        <div
          ref={scrollRef}
          tabIndex={0}
          className="flex flex-col gap-8 overflow-y-auto px-6 py-8 outline-none sm:px-12 sm:py-12"
        >
          {children}
          <div className="flex flex-col gap-2 border-t border-[#E7E4D9] pt-6">
            {confirming ? (
              <>
                <p className="font-medium">
                  Have you read the entire scenario?
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        setError(null)
                        try {
                          const result = await acknowledgeBriefing(eventSlug)
                          if (result.error || !result.href) {
                            setError(
                              result.error ?? "Could not continue. Try again."
                            )
                            return
                          }
                          router.push(result.href)
                        } catch {
                          setError("Could not continue. Try again.")
                        }
                      })
                    }
                  >
                    {pending ? "Continuing…" : "Yes, I have read it"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setConfirming(false)
                      setError(null)
                      scrollRef.current?.scrollTo({
                        top: 0,
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)"
                        ).matches
                          ? "auto"
                          : "smooth",
                      })
                    }}
                  >
                    No, send me back
                  </Button>
                </div>
              </>
            ) : (
              <Button
                type="button"
                className="w-fit"
                onClick={() => setConfirming(true)}
              >
                Continue to judging
              </Button>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
