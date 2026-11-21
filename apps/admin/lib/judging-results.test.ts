import { describe, expect, it } from "vitest"
import {
  formatResultAverage,
  judgingResults,
  parseResultsQuery,
  resultsFilters,
  resultsHref,
} from "./judging-results"

const id = "a0000000-0000-4000-8000-000000000001"
const row = {
  project_id: id,
  project_name: "Project",
  completed: 1,
  average_score: 4.125,
  insufficient_coverage: true,
  tied: false,
}
const data = {
  track_id: null,
  track_name: null,
  target: 3,
  has_more: false,
  projects: [row],
}

describe("judging results contracts", () => {
  it("distinguishes General from valid and malformed track selectors", () => {
    expect(parseResultsQuery({})).toEqual({
      filters: { trackId: null, page: 1 },
      invalidContext: false,
    })
    expect(parseResultsQuery({ resultsTrack: "general" }).invalidContext).toBe(
      false
    )
    expect(parseResultsQuery({ resultsTrack: id, resultsPage: "2" })).toEqual({
      filters: { trackId: id, page: 2 },
      invalidContext: false,
    })
    for (const value of ["bad", "", [id, id], ["general"], null])
      expect(parseResultsQuery({ resultsTrack: value }).invalidContext).toBe(
        true
      )
  })
  it("bounds pages and rejects untrusted loader inputs", () => {
    for (const value of ["0", "-1", "1.1", "2147483648", ["2"], undefined])
      expect(parseResultsQuery({ resultsPage: value }).filters.page).toBe(1)
    expect(parseResultsQuery({ resultsPage: "2147483647" }).filters.page).toBe(
      2147483647
    )
    expect(resultsFilters.parse({})).toEqual({ trackId: null, page: 1 })
    for (const input of [
      { trackId: "bad" },
      { page: 0 },
      { page: 2147483648 },
      { total: 20 },
    ])
      expect(resultsFilters.safeParse(input).success).toBe(false)
  })
  it("validates averages, counts, context metadata, coverage and bounded rows", () => {
    expect(judgingResults.parse(data)).toEqual(data)
    expect(
      judgingResults.safeParse({ ...data, target: null, projects: [] }).success
    ).toBe(true)
    for (const bad of [
      { ...row, completed: 0 },
      { ...row, average_score: null },
      { ...row, average_score: 5.1 },
      { ...row, average_score: 0.9 },
      { ...row, completed: -1 },
      { ...row, completed: 1.5 },
      { ...row, insufficient_coverage: false },
      { ...row, completed: 0, average_score: null, tied: true },
    ])
      expect(
        judgingResults.safeParse({ ...data, projects: [bad] }).success
      ).toBe(false)
    expect(
      judgingResults.safeParse({ ...data, projects: Array(51).fill(row) })
        .success
    ).toBe(false)
    expect(judgingResults.safeParse({ ...data, target: null }).success).toBe(
      false
    )
    expect(judgingResults.safeParse({ ...data, track_id: id }).success).toBe(
      false
    )
    expect(judgingResults.safeParse({}).success).toBe(false)
  })
  it("keeps null distinct from zero and rounds display only", () => {
    expect(formatResultAverage(null)).toBe("No reviews")
    expect(formatResultAverage(5)).toBe("5.00 / 5")
    expect(formatResultAverage(4.125)).toBe("4.13 / 5")
    expect(row.average_score).toBe(4.125)
  })
  it("encodes URLs and preserves other sections without overriding context", () => {
    const url = new URL(
      resultsHref(
        "event & one",
        { trackId: id, page: 2 },
        {
          projectsPage: "4",
          assignmentStatus: "submitted",
          resultsPage: "99",
          event: "wrong",
        }
      ),
      "https://example.test"
    )
    expect(url.searchParams.get("event")).toBe("event & one")
    expect(url.searchParams.get("resultsTrack")).toBe(id)
    expect(url.searchParams.get("resultsPage")).toBe("2")
    expect(url.searchParams.get("projectsPage")).toBe("4")
    expect(url.searchParams.get("assignmentStatus")).toBe("submitted")
    expect(url.hash).toBe("#results")
  })
})
