import type { SaveStatus } from "./use-draft-autosave"

export function SaveIndicator({
  status,
  error,
}: {
  status: SaveStatus | "incomplete"
  error: string | null
}) {
  if (status === "incomplete")
    return (
      <span role="status" className="text-[13px] text-destructive">
        Not saved: {error}
      </span>
    )
  if (status === "saving")
    return (
      <span role="status" className="text-[13px] text-[#6E6E68]">
        Saving...
      </span>
    )
  if (status === "error")
    return (
      <span role="alert" className="text-[13px] text-destructive">
        Save failed: {error}
      </span>
    )
  return (
    <span role="status" className="text-[13px] text-[#6E6E68]">
      All changes saved
    </span>
  )
}
