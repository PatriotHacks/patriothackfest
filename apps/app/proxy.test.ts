import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"
const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }))
vi.mock("@workspace/supabase/proxy", () => ({ updateSession }))
import { proxy } from "./proxy"

beforeEach(() => vi.clearAllMocks())
describe("project login redirects", () => {
  it("preserves project destination and existing session-error cookies", async () => {
    const response = NextResponse.redirect(
      "http://localhost:3001/login?error=session"
    )
    response.cookies.set("session-test", "expired")
    updateSession.mockResolvedValue(response)
    const result = await proxy(
      new NextRequest("http://localhost:3001/projects/fall-2026")
    )
    const url = new URL(result.headers.get("location")!)
    expect(url.searchParams.get("next")).toBe("/projects/fall-2026")
    expect(url.searchParams.get("error")).toBe("session")
    expect(result.cookies.get("session-test")?.value).toBe("expired")
  })
  it("does not change ordinary admissions redirects", async () => {
    updateSession.mockResolvedValue(
      NextResponse.redirect("http://localhost:3001/login")
    )
    const response = await proxy(
      new NextRequest("http://localhost:3001/apply/fall-2026")
    )
    expect(response.headers.get("location")).toBe("http://localhost:3001/login")
  })
  it("does not replace successful responses or unrelated locations", async () => {
    updateSession.mockResolvedValue(NextResponse.next())
    expect(
      (
        await proxy(new NextRequest("http://localhost:3001/projects"))
      ).headers.get("location")
    ).toBeNull()
    updateSession.mockResolvedValue(
      NextResponse.redirect("http://localhost:3001/start")
    )
    expect(
      (
        await proxy(new NextRequest("http://localhost:3001/projects"))
      ).headers.get("location")
    ).toBe("http://localhost:3001/start")
  })
})
