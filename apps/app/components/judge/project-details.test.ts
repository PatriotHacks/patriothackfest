import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { JudgeProjectDetails } from "./project-details"
describe("judge project rendering", () => {
  it("escapes content and rejects unsafe links without fetching URLs", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeProjectDetails, {
        detail: {
          project: {
            name: "Project",
            summary: "<script>bad</script>",
            description: "Details",
            technologies: "SQL",
            demo_url: "https://example.test",
            video_url: "javascript:alert(1)",
            repository_url: null,
          },
          assignment: {
            id: "a0000000-0000-4000-8000-000000000001",
            track_id: null,
            track_name: null,
            creativity_score: null,
            technical_score: null,
            impact_score: null,
            presentation_score: null,
            total_score: null,
            submitted_at: null,
            notes: "",
          },
          answers: [
            { label: "What inspired you?", answer: "<i>Curiosity</i>" },
            { label: "Anything else?", answer: "" },
          ],
        },
      })
    )
    expect(html).toContain("General judging")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).not.toContain("javascript:")
    expect(html).toContain("What inspired you?")
    expect(html).toContain("&lt;i&gt;Curiosity&lt;/i&gt;")
    expect(html).toContain("No answer")
  })
})
