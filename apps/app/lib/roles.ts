import type { Database } from "@workspace/supabase/types"

export type Role = Database["public"]["Enums"]["app_role"]

export const ROLES: Role[] = ["participant", "volunteer", "judge"]

export const ROLE_LABELS: Record<Role, string> = {
  participant: "Participant",
  volunteer: "Volunteer",
  judge: "Judge",
}
