import { projectReturnPath } from "./project-return-path"

// Keep project-only validation intact and add only implemented judge routes.
export function loginReturnPath(value: unknown): string {
  if (
    typeof value === "string" &&
    /^\/judge(?:\/[A-Za-z0-9_-]+)?\/?$/.test(value)
  )
    return value
  return projectReturnPath(value)
}
