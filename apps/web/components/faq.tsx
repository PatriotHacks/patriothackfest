import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"

import { site } from "@/content/site"

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-16"
    >
      <h2 id="faq-heading" className="text-2xl font-semibold">
        Frequently asked questions
      </h2>
      <Accordion type="single" collapsible>
        {site.faq.map((item, index) => (
          <AccordionItem key={item.question} value={`item-${index}`}>
            <AccordionTrigger className="text-base">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="max-w-[65ch] text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
