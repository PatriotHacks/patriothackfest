export function safeHttpUrl(value: string | null | undefined): string | null {
  const candidate = value?.trim()
  if (!candidate || /\s|\\/.test(candidate)) return null
  try {
    const url = new URL(candidate)
    return ["http:", "https:"].includes(url.protocol) &&
      url.host &&
      !url.username &&
      !url.password
      ? candidate
      : null
  } catch {
    return null
  }
}
