import { describe, expect, it } from "vitest"

import { filterProjects, filtersSearch, parseFilters } from "./filters"

const projects = [
  { name: "Winner Bot", tracks: [{ id: "t1" }], awards: [{}] },
  { name: "Alpha", tracks: [{ id: "t2" }], awards: [] },
  { name: "Beta Bot", tracks: [{ id: "t1" }, { id: "t2" }], awards: [] },
]

describe("filterProjects", () => {
  it("keeps the given order", () => {
    const filters = parseFilters(new URLSearchParams("q=bot"))
    expect(filterProjects(projects, filters).map((p) => p.name)).toEqual([
      "Winner Bot",
      "Beta Bot",
    ])
  })

  it("combines track and winners filters", () => {
    expect(
      filterProjects(projects, { query: "", track: "t2", winners: false })
    ).toEqual([projects[1], projects[2]])
    expect(
      filterProjects(projects, { query: "", track: "t1", winners: true })
    ).toEqual([projects[0]])
  })
})

describe("filtersSearch", () => {
  it("round-trips filters through the URL", () => {
    const filters = { query: " bot ", track: "t1", winners: true }
    expect(filtersSearch(filters)).toBe("?q=bot&track=t1&winners=1")
    expect(parseFilters(new URLSearchParams(filtersSearch(filters)))).toEqual({
      query: "bot",
      track: "t1",
      winners: true,
    })
  })

  it("is empty without filters", () => {
    expect(filtersSearch({ query: "", track: null, winners: false })).toBe("")
  })
})
