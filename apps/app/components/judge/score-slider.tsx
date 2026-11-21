"use client"

import { Slider } from "@workspace/ui/components/slider"
import { cn } from "@workspace/ui/lib/utils"

import {
  formatScore,
  SCORE_MAX,
  SCORE_MIN,
  SCORE_STEP,
  type JudgeCriterion,
} from "@/lib/judge-reviews"

const PLACEHOLDER = (SCORE_MIN + SCORE_MAX) / 2

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
          {unset ? "Not scored" : `${formatScore(value)} / ${SCORE_MAX}`}
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
        value={[value ?? PLACEHOLDER]}
        disabled={disabled}
        data-unset={unset || undefined}
        className="py-2 data-unset:**:data-[slot=slider-range]:hidden data-unset:**:data-[slot=slider-thumb]:opacity-0 data-unset:**:data-[slot=slider-thumb]:focus-visible:opacity-100"
        // Clicking an unset slider exactly on the hidden placeholder must still score it.
        onPointerDown={() => unset && !disabled && onChange(PLACEHOLDER)}
        onValueChange={([next]) => onChange(next!)}
      />
      <div className="flex justify-between text-xs text-[#6E6E68]">
        <span>{formatScore(SCORE_MIN)}</span>
        <span>{formatScore(SCORE_MAX)}</span>
      </div>
    </div>
  )
}
