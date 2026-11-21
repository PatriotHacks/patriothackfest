import { describe, expect, it } from "vitest"
import {
  eventJudgeInput,
  transferPreviewMessage,
  transferResultMessage,
} from "./judges"
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
describe("judge transfer messages", () => {
  it("describes the preview", () => {
    expect(transferPreviewMessage({ unsubmitted: 4, drafts: 1 })).toBe(
      "4 assignments will move to other judges; 1 has draft scores that will be discarded."
    )
    expect(transferPreviewMessage({ unsubmitted: 1, drafts: 0 })).toBe(
      "1 assignment will move to other judges; 0 have draft scores that will be discarded."
    )
    expect(transferPreviewMessage({ unsubmitted: 0, drafts: 0 })).toBe(
      "No unsubmitted assignments to move."
    )
  })
  it("describes the result and what to do about missing judges", () => {
    expect(
      transferResultMessage({ moved: 3, dropped_drafts: 1, missing: 0 })
    ).toBe("Moved 3 assignments.")
    expect(
      transferResultMessage({ moved: 1, dropped_drafts: 0, missing: 2 })
    ).toBe(
      "Moved 1 assignment. 2 projects still need a judge (raise judge limits and click Generate missing assignments)."
    )
  })
})
