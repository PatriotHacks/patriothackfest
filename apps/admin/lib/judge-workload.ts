export type JudgeWorkload = {
  needed: number
  judges: number
  perJudge: number
  low: number
  high: number
  capacity: number
  shortBy: number
  tooFewJudges: boolean
}

export function judgeWorkload(
  projects: number,
  reviewsPerProject: number,
  capacities: number[]
): JudgeWorkload {
  const needed = projects * reviewsPerProject
  const judges = capacities.length
  const perJudge = judges ? needed / judges : 0
  const capacity = capacities.reduce(
    (sum, value) => sum + Math.min(value, projects),
    0
  )
  return {
    needed,
    judges,
    perJudge,
    low: Math.floor(perJudge),
    high: Math.ceil(perJudge),
    capacity,
    shortBy: Math.max(needed - capacity, 0),
    tooFewJudges: projects > 0 && reviewsPerProject > judges,
  }
}

export function workloadCapacities(
  judges: { active: boolean; guest: boolean; kind: string; capacity: number }[]
) {
  return judges
    .filter((judge) => judge.active && !judge.guest && judge.kind === "general")
    .map((judge) => judge.capacity)
}
