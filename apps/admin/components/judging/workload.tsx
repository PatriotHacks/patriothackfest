"use client"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useId, useState } from "react"

import { judgeWorkload } from "@/lib/judge-workload"

export function JudgeWorkload({
  projects,
  reviewsPerProject,
  capacities,
}: {
  projects: number
  reviewsPerProject: number
  capacities: number[]
}) {
  const id = useId()
  const [reviews, setReviews] = useState(reviewsPerProject)
  const result = judgeWorkload(projects, reviews, capacities)

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">Judge workload</h2>
      <div className="flex w-fit flex-col gap-1">
        <Label htmlFor={`${id}-reviews`}>
          What if reviews per project were
        </Label>
        <Input
          id={`${id}-reviews`}
          type="number"
          min={1}
          max={20}
          value={reviews}
          onChange={(event) => setReviews(Number(event.target.value))}
        />
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        <li>
          {projects} submitted projects × {reviews} reviews = {result.needed}{" "}
          reviews needed
        </li>
        <li>{result.judges} active general judges (guests excluded)</li>
        {result.judges > 0 && (
          <li>
            {result.low === result.high
              ? `${result.low} reviews each`
              : `About ${result.perJudge.toFixed(1)} reviews each (${result.low} to ${result.high})`}
          </li>
        )}
        <li>
          Capacity {result.capacity} of {result.needed} needed
        </li>
      </ul>
      {result.shortBy > 0 && (
        <p className="text-sm text-destructive">
          Capacity is short by {result.shortBy} reviews, so some projects will
          get fewer than {reviews} reviews.
        </p>
      )}
      {result.tooFewJudges && (
        <p className="text-sm text-destructive">
          {reviews} reviews per project needs at least {reviews} active general
          judges, because a judge cannot review the same project twice.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Estimate only. Judges never review their own team&apos;s project, and
        sponsor tracks are not included. Changing the number here does not save
        it.
      </p>
    </div>
  )
}
