import * as z from "zod"

export const LENGTH_UNITS = ["characters", "words"] as const
export const lengthUnitSchema = z.enum(LENGTH_UNITS)
export type LengthUnit = z.infer<typeof lengthUnitSchema>

export const LENGTH_UNIT_LABELS: Record<LengthUnit, string> = {
  characters: "Characters",
  words: "Words",
}

export const MAX_WORD_LIMIT = 1500
export const WORD_LIMIT_MESSAGE = `Word limits must be at most ${MAX_WORD_LIMIT} words`

export function countWords(text: string) {
  const trimmed = text.trim()
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length
}

export function textLength(text: string, unit: LengthUnit) {
  return unit === "words" ? countWords(text) : [...text.trim()].length
}

export function formatLength(count: number, unit: LengthUnit) {
  return `${count} ${count === 1 ? unit.slice(0, -1) : unit}`
}

export function limitForUnit(limit: number, unit: LengthUnit) {
  return unit === "words" ? Math.min(limit, MAX_WORD_LIMIT) : limit
}
