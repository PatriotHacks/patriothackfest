import { Button } from "@workspace/ui/components/button"

export default function Page() {
  return (
    <main className="flex min-h-svh flex-col items-start gap-4 p-6">
      <h1 className="text-2xl font-semibold">Patriot HackFest Applications</h1>
      <Button disabled>Sign in with Google</Button>
    </main>
  )
}
