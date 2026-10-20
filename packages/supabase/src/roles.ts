import type { Database } from "./database.types"

export type Role = Database["public"]["Enums"]["app_role"]

export const ROLES: Role[] = ["participant", "volunteer", "judge"]

export const ROLE_LABELS: Record<Role, string> = {
  participant: "Participant",
  volunteer: "Volunteer",
  judge: "Judge",
}

export function roleLabel(role: Role, eventSlug: string | undefined) {
  return role === "volunteer" && eventSlug === "fall-2026"
    ? "Mentor"
    : ROLE_LABELS[role]
}
