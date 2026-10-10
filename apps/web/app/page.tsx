import { Button } from "@workspace/ui/components/button"

export default function Page() {
  return (
    <main className="flex min-h-svh flex-col items-start gap-4 p-6">
      <h1 className="text-2xl font-semibold">Patriot HackFest</h1>
      <Button asChild>
        <a href={process.env.NEXT_PUBLIC_APP_URL}>Apply</a>
      </Button>
    </main>
  )
}
