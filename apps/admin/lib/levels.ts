import type { Database } from "@workspace/supabase/types"

export type AdminLevel = Database["public"]["Enums"]["admin_level"]

export const ADMIN_LEVELS: AdminLevel[] = ["owner", "organizer", "reviewer"]

export function hasLevel(level: AdminLevel, min: AdminLevel) {
  return ADMIN_LEVELS.indexOf(level) <= ADMIN_LEVELS.indexOf(min)
}
