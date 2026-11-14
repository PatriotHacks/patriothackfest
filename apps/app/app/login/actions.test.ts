import { beforeEach, describe, expect, it, vi } from "vitest"
const { createClient, verifyOtp, signInWithOtp, redirect } = vi.hoisted(() => ({
  createClient: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithOtp: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))
vi.mock("@workspace/supabase/server", () => ({ createClient }))
vi.mock("next/navigation", () => ({ redirect }))
import { sendCode, verifyCode } from "./actions"

beforeEach(() => {
  vi.clearAllMocks()
  createClient.mockResolvedValue({ auth: { verifyOtp, signInWithOtp } })
  verifyOtp.mockResolvedValue({ error: null })
  signInWithOtp.mockResolvedValue({ error: null })
})

describe("participant OTP and project return", () => {
  it("keeps ordinary sign-in going to the existing admissions entry", async () => {
    await expect(verifyCode("person@example.com", "123456")).rejects.toThrow(
      "redirect:/start"
    )
    expect(verifyOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      token: "123456",
      type: "email",
    })
  })
  it("returns to a validated project path after verification", async () => {
    await expect(
      verifyCode("person@example.com", "123456", "/projects/fall-2026")
    ).rejects.toThrow("redirect:/projects/fall-2026")
  })
  it("does not redirect externally even if a caller bypasses the login page", async () => {
    await expect(
      verifyCode("person@example.com", "123456", "//evil.test")
    ).rejects.toThrow("redirect:/start")
  })
  it("never redirects after a failed or malformed code", async () => {
    expect(
      (await verifyCode("person@example.com", "bad", "/projects")).error
    ).toBeTruthy()
    expect(verifyOtp).not.toHaveBeenCalled()
    verifyOtp.mockResolvedValue({ error: { message: "Invalid code" } })
    expect(
      await verifyCode("person@example.com", "123456", "/projects")
    ).toEqual({ error: "Invalid code" })
    expect(redirect).not.toHaveBeenCalled()
  })
  it("preserves the existing email-code request behavior", async () => {
    expect(await sendCode("person@example.com")).toEqual({ error: null })
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: { shouldCreateUser: true },
    })
  })
})
