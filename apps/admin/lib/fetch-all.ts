import "server-only"

const PAGE_SIZE = 1000

type Page<T> = PromiseLike<
  { data: T[]; error: null } | { data: null; error: { message: string } }
>

export async function fetchAll<T>(page: (from: number, to: number) => Page<T>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}
