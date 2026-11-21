import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { JudgeQueueList } from "./queue"
const id = "a0000000-0000-4000-8000-000000000001"
describe("judge queue", () => {
  it("counts contexts separately and links unfinished and read-only assignments", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeQueueList, {
        eventSlug: "fall-2026",
        startHref: "/judge/fall-2026/briefing",
        queue: {
          total: 2,
          completed: 1,
          assignments: [
            {
              id,
              project_name: "Same project",
              track_id: id,
              track_name: "Track A",
              submitted_at: "date",
              in_progress: true,
            },
            {
              id: "a0000000-0000-4000-8000-000000000002",
              project_name: "Same project",
              track_id: id,
              track_name: "Track B",
              submitted_at: null,
              in_progress: true,
            },
          ],
        },
      })
    )
    expect(html).toContain("1 / 2 reviews completed")
    expect(html).toContain("Track A")
    expect(html).toContain("Track B")
    expect(html).toContain("Submitted")
    expect(html).toContain("Draft saved")
    expect(html).toContain("Continue judging")
    expect(html).toContain('href="/judge/fall-2026/briefing"')
    expect(html).toContain("mailto:hello@patriothackfest.com")
  })
  it("hides the start link when judging is not open", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeQueueList, {
        eventSlug: "fall-2026",
        startHref: null,
        queue: {
          total: 1,
          completed: 0,
          assignments: [
            {
              id,
              project_name: "Project",
              track_id: null,
              track_name: null,
              submitted_at: null,
              in_progress: false,
            },
          ],
        },
      })
    )
    expect(html).not.toContain("Start judging")
    expect(html).toContain("Not started")
  })
  it("shows honest empty state instead of fake completed work", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeQueueList, {
        eventSlug: "fall-2026",
        queue: { total: 0, completed: 0, assignments: [] },
        startHref: null,
      })
    )
    expect(html).toContain("No reviews assigned")
    expect(html).not.toContain("All assigned reviews are complete")
  })
})
