"use client"

import { Button } from "@workspace/ui/components/button"
import Link from "next/link"

export default function JudgeError({ reset }: { reset: () => void }) {
  return (
    <section className="flex flex-col items-start gap-4" role="alert">
      <h1 className="text-2xl font-semibold">Could not load judging</h1>
      <p>
        Your queue could not be loaded. This does not mean there are no
        assignments.
      </p>
      <Button onClick={reset}>Try again</Button>
      <Link className="underline" href="/judge">
        Your judging events
      </Link>
    </section>
  )
}
