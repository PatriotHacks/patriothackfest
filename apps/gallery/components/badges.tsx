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
        <li
          key={award.id}
          className="border-ink bg-yellow text-ink inline-block -rotate-2 rounded-md border-2 px-2.5 py-1 text-xs leading-none font-bold tracking-[0.08em] uppercase"
        >
          {award.name}
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
        <li
          key={track.id}
          className="border-lav/50 text-lav rounded-full border px-3 py-1 text-[13px] leading-none font-medium"
        >
          {track.name}
        </li>
      ))}
    </ul>
  )
}
