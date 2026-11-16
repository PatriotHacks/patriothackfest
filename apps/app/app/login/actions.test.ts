import { beforeEach, describe, expect, it, vi } from "vitest"
const { createClient, verifyOtp, signInWithOtp, rpc, redirect } = vi.hoisted(
  () => ({
    createClient: vi.fn(),
    verifyOtp: vi.fn(),
    signInWithOtp: vi.fn(),
    rpc: vi.fn(),
    redirect: vi.fn((path: string) => {
      throw new Error(`redirect:${path}`)
    }),
  })
)
vi.mock("@workspace/supabase/server", () => ({ createClient }))
vi.mock("next/navigation", () => ({ redirect }))
import { sendCode, verifyCode } from "./actions"

beforeEach(() => {
  vi.clearAllMocks()
  createClient.mockResolvedValue({ auth: { verifyOtp, signInWithOtp }, rpc })
  rpc.mockResolvedValue({ data: [], error: null })
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
    expect(rpc).toHaveBeenCalledWith("judge_events")
  })
  it("sends rostered judges without a destination to the judging portal", async () => {
    rpc.mockResolvedValue({ data: [{ slug: "fall-2026" }], error: null })
    await expect(verifyCode("judge@example.com", "123456")).rejects.toThrow(
      "redirect:/judge"
    )
    await expect(
      verifyCode("judge@example.com", "123456", "//evil.test")
    ).rejects.toThrow("redirect:/judge")
  })
  it("keeps an explicit destination ahead of the judge lookup", async () => {
    rpc.mockResolvedValue({ data: [{ slug: "fall-2026" }], error: null })
    await expect(
      verifyCode("judge@example.com", "123456", "/projects/fall-2026")
    ).rejects.toThrow("redirect:/projects/fall-2026")
    expect(rpc).not.toHaveBeenCalled()
  })
  it("surfaces a failed judge lookup instead of guessing a destination", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "lookup failed" } })
    expect(await verifyCode("judge@example.com", "123456")).toEqual({
      error: "lookup failed",
    })
    expect(redirect).not.toHaveBeenCalled()
  })
  it("returns to a validated project path after verification", async () => {
    await expect(
      verifyCode("person@example.com", "123456", "/projects/fall-2026")
    ).rejects.toThrow("redirect:/projects/fall-2026")
  })
  it("returns judges to their event without participant onboarding", async () => {
    await expect(
      verifyCode("person@example.com", "123456", "/judge/fall-2026")
    ).rejects.toThrow("redirect:/judge/fall-2026")
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
