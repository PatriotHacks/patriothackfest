import { describe, expect, it } from "vitest"

import { adminAwardsSchema, awardCandidates, awardInput } from "./awards"

const eventId = "e0000000-0000-4000-8000-000000000001"
const trackId = "b0000000-0000-4000-8000-000000000001"
const project = (n: number, trackIds: string[] = []) => ({
  id: `a0000000-0000-4000-8000-00000000000${n}`,
  name: `Project ${n}`,
  track_ids: trackIds,
})

describe("award helpers", () => {
  it("offers unassigned projects, limited to the award track", () => {
    const projects = [project(1), project(2, [trackId]), project(3, [trackId])]
    const winner = { ...project(2), status: "submitted" as const }
    expect(
      awardCandidates({ track_id: null, projects: [winner] }, projects)
    ).toEqual([projects[0], projects[2]])
    expect(
      awardCandidates({ track_id: trackId, projects: [winner] }, projects)
    ).toEqual([projects[2]])
  })
  it("trims names and validates rank", () => {
    expect(
      awardInput.parse({ eventId, name: " Best ", rank: 1, trackId: null })
    ).toEqual({ eventId, name: "Best", rank: 1, trackId: null })
    for (const value of [
      { eventId, name: " ", rank: 1, trackId: null },
      { eventId, name: "Best", rank: 0, trackId: null },
      { eventId, name: "Best", rank: 1.5, trackId: null },
      { eventId, name: "Best", rank: 1001, trackId: null },
    ])
      expect(awardInput.safeParse(value).success).toBe(false)
  })
  it("parses the admin awards listing", () => {
    expect(
      adminAwardsSchema.parse({
        awards: [
          {
            id: eventId,
            name: "Best",
            rank: 1,
            track_id: null,
            projects: [{ ...project(1), status: "withdrawn" }],
          },
        ],
        projects: [project(1, [trackId])],
      }).awards[0]?.projects[0]?.status
    ).toBe("withdrawn")
  })
})
