import { describe, expect, it } from "vitest"

import { renderStatusUpdate } from "./templates"

describe("renderStatusUpdate output", () => {
  it("matches the saved markup", () => {
    const email = renderStatusUpdate(
      {
        subject: "Update: {{event_name}}",
        body: "Hi {{name}},\n\nSee you {{event_dates}} as a {{role}}.\nLine <two> & more\n\nBye",
      },
      {
        name: "Ada",
        event_name: "Patriot HackFest 2026",
        event_dates: "Nov 14–15, 2026",
        role: "participant",
      },
      "https://x.test/?a=1&b=2"
    )
    expect(email).toMatchSnapshot()
  })
})
