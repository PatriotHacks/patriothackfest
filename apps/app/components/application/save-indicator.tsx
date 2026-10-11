import type { SaveStatus } from "./use-draft-autosave"

export function SaveIndicator({
  status,
  error,
}: {
  status: SaveStatus
  error: string | null
}) {
  if (status === "saving")
    return (
      <span role="status" className="text-sm text-muted-foreground">
        Saving...
      </span>
    )
  if (status === "error")
    return (
      <span role="alert" className="text-sm text-destructive">
        Save failed: {error}
      </span>
    )
  return (
    <span role="status" className="text-sm text-muted-foreground">
      All changes saved
    </span>
  )
}
