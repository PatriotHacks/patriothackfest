export function projectNavigationLeavesPage(href: string, current: string) {
  try {
    const from = new URL(current)
    const to = new URL(href, from)
    return (
      to.origin === from.origin &&
      (to.pathname !== from.pathname || to.search !== from.search)
    )
  } catch {
    return false
  }
}
