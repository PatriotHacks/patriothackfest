import { Pill } from "@workspace/ui/components/pill"
import { cn } from "@workspace/ui/lib/utils"

type Ref = { id: string; name: string }

export function AwardBadges({
  awards,
  className,
}: {
  awards: (Ref & { rank: number })[]
  className?: string
}) {
  if (awards.length === 0) return null
  return (
    <ul aria-label="Awards" className={cn("flex flex-wrap gap-2", className)}>
      {awards.map((award) => (
        <li key={award.id}>
          <Pill tone="amber" className="font-semibold">
            {award.name}
          </Pill>
        </li>
      ))}
    </ul>
  )
}

export function TrackChips({
  tracks,
  className,
}: {
  tracks: Ref[]
  className?: string
}) {
  if (tracks.length === 0) return null
  return (
    <ul aria-label="Tracks" className={cn("flex flex-wrap gap-2", className)}>
      {tracks.map((track) => (
        <li key={track.id}>
          <Pill tone="sage" size="sm">
            {track.name}
          </Pill>
        </li>
      ))}
    </ul>
  )
}
