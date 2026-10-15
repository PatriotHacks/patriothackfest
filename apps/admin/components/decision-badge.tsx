import { Pill } from "@workspace/ui/components/pill"

import { DECISION_LABELS, type Decision } from "@/lib/roles"

const TONES = {
  pending: "muted",
  accepted: "olive",
  waitlisted: "amber",
  rejected: "brick",
} as const

export function DecisionBadge({
  decision,
  size,
}: {
  decision: Decision | null
  size?: "default" | "sm"
}) {
  if (!decision)
    return (
      <Pill tone="outline" size={size}>
        Undecided
      </Pill>
    )
  return (
    <Pill tone={TONES[decision]} size={size}>
      {DECISION_LABELS[decision]}
    </Pill>
  )
}
