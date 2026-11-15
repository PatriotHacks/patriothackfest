// Only the implemented project routes are accepted. No queries, escapes,
// protocol-relative URLs, or backslashes can become an authentication redirect.
export function projectReturnPath(value: unknown): string {
  return typeof value === "string" &&
    /^\/projects(?:\/[A-Za-z0-9_-]+(?:\/[0-9a-fA-F-]{36})?)?\/?$/.test(value)
    ? value
    : "/start"
}
