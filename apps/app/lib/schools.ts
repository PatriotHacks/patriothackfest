// US names from Hipo university-domains-list (MIT, github.com/Hipo/university-domains-list) plus Wikipedia's list of Virginia colleges.
import schools from "./schools.json"

const ORDERED: readonly string[] = [...schools.virginia, ...schools.other]
const LISTED = new Set(ORDERED)

export function isListedSchool(name: string) {
  return LISTED.has(name)
}

export function searchSchools(query: string, limit: number) {
  const term = query.trim().toLowerCase()
  const matches = term
    ? ORDERED.filter((name) => name.toLowerCase().includes(term))
    : ORDERED
  return matches.slice(0, limit)
}
