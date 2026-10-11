import { Badge } from "@workspace/ui/components/badge"

import { DECISION_LABELS, type Decision } from "@/lib/roles"

const VARIANTS = {
  pending: "outline",
  accepted: "default",
  waitlisted: "secondary",
  rejected: "destructive",
} as const

export function DecisionBadge({ decision }: { decision: Decision | null }) {
  if (!decision) return <Badge variant="outline">Undecided</Badge>
  return <Badge variant={VARIANTS[decision]}>{DECISION_LABELS[decision]}</Badge>
}
