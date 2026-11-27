export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: React.ReactNode
  title: string
  children?: React.ReactNode
}) {
  return (
    <section className="sky px-4 pt-36 pb-24 max-[720px]:pt-32">
      <div className="mx-auto flex w-[min(1080px,100%)] flex-col gap-4">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="text-[clamp(36px,5vw,56px)] font-bold tracking-[-0.03em] break-words text-white">
          {title}
        </h1>
        <span className="squiggle" aria-hidden="true" />
        {children}
      </div>
    </section>
  )
}

export function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <section className="sheet -mt-12 flex-1 pt-16 pb-24 max-[720px]:pt-12">
      <div className="mx-auto w-[min(1080px,100%-32px)]">{children}</div>
    </section>
  )
}
