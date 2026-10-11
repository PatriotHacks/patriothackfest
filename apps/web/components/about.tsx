import { site } from "@/content/site"

export function About() {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-16"
    >
      <h2 id="about-heading" className="text-2xl font-semibold">
        About
      </h2>
      <p className="text-muted-foreground">{site.about}</p>
    </section>
  )
}
