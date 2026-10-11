import { GoogleSignInButton } from "@/components/google-sign-in-button"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Patriot HackFest Admin</h1>
      <GoogleSignInButton />
      {error && (
        <p className="text-sm text-destructive">
          Sign in failed. Please try again.
        </p>
      )}
    </main>
  )
}
