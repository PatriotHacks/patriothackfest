import { Badge } from "@workspace/ui/components/badge"

import type { StatusLabel } from "@/lib/application-status"

export function ApplicationStatusBadge({ status }: { status: StatusLabel }) {
  return <Badge variant={status.variant}>{status.label}</Badge>
}
