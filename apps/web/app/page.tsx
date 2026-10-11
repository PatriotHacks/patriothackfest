import { About } from "@/components/about"
import { Faq } from "@/components/faq"
import { Hero } from "@/components/hero"
import { Roles } from "@/components/roles"
import { SiteFooter } from "@/components/site-footer"

export default function Page() {
  return (
    <>
      <main>
        <Hero />
        <About />
        <Roles />
        <Faq />
      </main>
      <SiteFooter />
    </>
  )
}
