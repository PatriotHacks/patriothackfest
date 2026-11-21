import { SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

const QUESTIONS = [
  "Blackouts in the deep levels now last for days, and no one knows when the next one will hit. How would you warn people before the power or air cuts out?",
  "When power runs short, the Directorate decides who keeps the lights, and the deep levels always lose. How would you share power, water and food fairly when there isn’t enough to go around?",
  "The geothermal plants are aging and the deep levels get hotter every year, while the cooling fans fall further behind. How would you keep the lower levels livable?",
  "Water recyclers in the lower levels are breaking down, and what comes through the taps is making people sick. How would you catch bad water before people drink it?",
  "Waste and sewage back up into the old tunnels, and one flooded section can cut off a whole neighborhood. How would you keep the tunnels safe to live and move through?",
  "The Hollow was dug for millions, not billions, and families are packed into rooms meant for one. How would you find or make more space, or help people share what little there is?",
  "The Directorate controls the network and can shut it down whenever it wants. How would people organize, share information or call for help without it?",
  "When a blackout hits, families split across levels have no way to know if each other are okay. How would you reconnect them?",
  "Lung sickness is spreading through the lower levels, and the Directorate’s numbers don’t match what people see. How would you track the real outbreak and get supplies where they’re needed?",
  "Medicine runs out in the deep levels first, and the nearest clinic can be levels away. How would you get basic care to people who can’t reach it?",
  "A lifetime without sunlight changes sleep, mood and the body, and no one is measuring it. How would you track and treat what living underground does to people?",
  "If the central farms cut off a neighborhood, it has days of food left. How would a neighborhood grow and share its own food?",
  "Many residents believe the surface has healed, and the Directorate insists the air up there would kill you in minutes. How would you prove whether it’s safe, and get the true answer to everyone?",
  "Going back up will not happen all at once, and the first people to try will need suits, domes or sealed outposts. How would you figure out which option works and who should try it first?",
  "If the surface really is safe, hundreds of millions will want to go back up. How would you plan that move?",
]

export function JudgeScenario() {
  return (
    <article className="flex flex-col gap-4 leading-relaxed">
      <p className="rounded-md border border-[#E7E4D9] bg-white p-3 text-sm">
        This is the build scenario participants received. Read it before
        judging.
      </p>
      <header className="flex flex-col gap-1">
        <h2 className={cn(SERIF, "text-3xl")}>Life underground</h2>
        <p className="font-semibold">A dystopian hackathon track</p>
      </header>
      <p>
        Two billion people live beneath a dead surface, and their systems are
        failing. Your job is to support them and help save them.
      </p>
      <h3 className="text-lg font-semibold">The world</h3>
      <p>
        In 2087, the surface became unlivable. After decades of superstorms,
        fires and poisoned air, what was left of humanity moved underground. Two
        billion people now live in the Hollow, a network of cities carved into
        old mines and subway tunnels, stacked in levels beneath the dead cities
        above. The surface was overtaken by the technology humanity left behind:
        machines still run the dead cities, answering to no one. No one has been
        to the surface in thirty years.
      </p>
      <p>
        Life in the Hollow runs on rationing. The tunnels were dug for millions,
        not billions, and every level is overcrowded. Power comes from aging
        geothermal plants. Water is recycled endlessly. Food grows under lamps
        in communal farms, and light is a utility you pay for. The Directorate,
        the government of the Hollow, controls the air supply, the network and
        all movement between levels. The upper levels get light, fresh air and
        space. The deeper you live, the darker, hotter and sicker it gets, and
        the deep levels are where the blackouts hit first.
      </p>
      <p>
        Now the systems are failing. Blackouts last for days. Water recyclers in
        the lower levels are breaking down. Lung sickness is spreading, and the
        Directorate’s public numbers don’t match what people see. And through
        all of it, people want to go back. The surface is home, and reinhabiting
        it is what the Hollow dreams about, but the way up is overrun by the
        machines humanity left behind, so for now it stays closed. A growing
        number of residents believe the surface has healed and the Directorate
        is hiding it. Your job: build something that helps the people of the
        Hollow survive, and maybe find their way back up.
      </p>
      <h3 className="text-lg font-semibold">What to build</h3>
      <p>
        Each problem below is something happening in the Hollow right now,
        spanning power, the environment, crowding, communication, health and the
        way back to the surface. Ideally, one well-connected solution addresses
        several of these problems at the same time, and that can strengthen your
        project in judging.
      </p>
      <ul className="flex list-outside list-disc flex-col gap-2 pl-5">
        {QUESTIONS.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
      <p>
        As a team, decide the best way to approach the Hollow: build something
        that makes life underground more sustainable, or something that helps
        people get back to the surface. Both paths are worth building. Pick one
        question or combine a few. Every answer helps someone in the Hollow.
      </p>
    </article>
  )
}
