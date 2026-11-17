import type { Field } from "@workspace/forms"
import { describe, expect, it, vi } from "vitest"

const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { saveField } from "./actions"

const text = (validation: object) =>
  ({
    id: "00000000-0000-4000-8000-000000000001",
    type: "long_text",
    label: "Why",
    help_text: null,
    required: false,
    options: null,
    validation,
    condition: null,
  }) as Field

describe("saveField", () => {
  it("reports the word cap instead of a generic error", async () => {
    expect(
      await saveField(text({ max_length: 1501, length_unit: "words" }))
    ).toEqual({ error: "Word limits must be at most 1500 words" })
    expect(requireAdmin).not.toHaveBeenCalled()
  })

  it("keeps the generic error for other invalid settings", async () => {
    expect(await saveField(text({ max_length: -1 }))).toEqual({
      error: "Invalid question settings",
    })
  })
})
