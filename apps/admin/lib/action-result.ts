export type ActionResult = { error: string | null }

export const ok: ActionResult = { error: null }

export function failure(error: { message: string }): ActionResult {
  return { error: error.message }
}
