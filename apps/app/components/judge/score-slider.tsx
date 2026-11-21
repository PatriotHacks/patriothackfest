"use client"

import { Button } from "@workspace/ui/components/button"
import { Slider } from "@workspace/ui/components/slider"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import {
  formatScore,
  SCORE_MAX,
  SCORE_MIN,
  SCORE_START,
  SCORE_STEP,
  stepScore,
  type JudgeCriterion,
} from "@/lib/judge-reviews"

export function ScoreSlider({
  criterion,
  value,
  disabled,
  onChange,
}: {
  criterion: JudgeCriterion
  value: number | null
  disabled: boolean
  onChange: (value: number) => void
}) {
  const labelId = `criterion-${criterion.id}`
  const unset = value === null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={labelId} className="font-semibold break-words">
          {criterion.name}
        </h3>
        <span
          className={cn(
            "shrink-0 text-sm tabular-nums",
            unset ? "text-[#6E6E68]" : "font-semibold"
          )}
        >
          {unset ? "Not scored" : formatScore(value)}
        </span>
      </div>
      {criterion.description && (
        <p className="text-sm whitespace-pre-line text-[#6E6E68]">
          {criterion.description}
        </p>
      )}
      <Slider
        thumbProps={{
          "aria-labelledby": labelId,
          "aria-valuetext": unset ? "Not scored" : formatScore(value),
        }}
        min={SCORE_MIN}
        max={SCORE_MAX}
        step={SCORE_STEP}
        value={[value ?? SCORE_START]}
        disabled={disabled}
        data-unset={unset || undefined}
        className="py-2 data-unset:**:data-[slot=slider-range]:hidden data-unset:**:data-[slot=slider-thumb]:border-[#B8B5AA] data-unset:**:data-[slot=slider-thumb]:bg-[#F3F1EA]"
        // Pressing an unset slider at its start value fires no value change.
        onPointerDown={() => unset && !disabled && onChange(SCORE_START)}
        onValueChange={([next]) => onChange(next!)}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-[#6E6E68]">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Lower ${criterion.name} by 0.1`}
          disabled={disabled || value === SCORE_MIN}
          onClick={() => onChange(stepScore(value, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="mr-auto">{formatScore(SCORE_MIN)}</span>
        <span>{formatScore(SCORE_MAX)}</span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Raise ${criterion.name} by 0.1`}
          disabled={disabled || value === SCORE_MAX}
          onClick={() => onChange(stepScore(value, 1))}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
