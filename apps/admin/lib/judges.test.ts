import { describe, expect, it } from "vitest"
import { eventJudgeInput } from "./judges"
const id = "a0000000-0000-4000-8000-000000000001"
const general = {
  eventId: id,
  email: " Person@Example.com ",
  kind: "general",
  active: true,
  capacity: 20,
  trackIds: [],
}
describe("judge form validation", () => {
  it("normalizes email and permits unregistered email addresses", () => {
    expect(eventJudgeInput.parse(general).email).toBe("person@example.com")
  })
  it("validates capacity and event/track identity", () => {
    for (const change of [
      { capacity: 0 },
      { capacity: 1001 },
      { capacity: 1.5 },
      { eventId: "bad" },
      { trackIds: ["bad"] },
      { email: "not-an-email" },
    ]) {
      expect(eventJudgeInput.safeParse({ ...general, ...change }).success).toBe(
        false
      )
    }
  })
  it("requires sponsor scopes and forbids them for general judges", () => {
    expect(
      eventJudgeInput.safeParse({ ...general, kind: "sponsor" }).success
    ).toBe(false)
    expect(
      eventJudgeInput.safeParse({ ...general, trackIds: [id] }).success
    ).toBe(false)
    expect(
      eventJudgeInput.safeParse({ ...general, kind: "sponsor", trackIds: [id] })
        .success
    ).toBe(true)
  })
  it("does not accept user bindings from the browser", () => {
    expect(eventJudgeInput.safeParse({ ...general, user_id: id }).success).toBe(
      false
    )
  })
})
