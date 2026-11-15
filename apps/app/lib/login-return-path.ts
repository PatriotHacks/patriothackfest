import { projectReturnPath } from "./project-return-path"

// Allow only local judge routes, including UUID assignment deep links.
export function loginReturnPath(value: unknown): string {
  if (
    typeof value === "string" &&
    /^\/judge(?:\/[A-Za-z0-9_-]+(?:\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})?)?\/?$/.test(
      value
    )
  )
    return value
  return projectReturnPath(value)
}
