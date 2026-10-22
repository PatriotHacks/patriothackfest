import { roleLabel, type Role } from "@workspace/supabase/roles"

export const APPLICATION_TABS = [
  { slug: "participants", role: "participant" },
  { slug: "mentors", role: "volunteer" },
  { slug: "judges", role: "judge" },
] as const satisfies { slug: string; role: Role }[]

export type ApplicationTab = (typeof APPLICATION_TABS)[number]

export function tabForRole(role: Role) {
  return APPLICATION_TABS.find((tab) => tab.role === role)!
}

export function tabPath(tab: ApplicationTab) {
  return `/applications/${tab.slug}`
}

export function tabLabel(tab: ApplicationTab, eventSlug: string | undefined) {
  return `${roleLabel(tab.role, eventSlug)}s`
}
