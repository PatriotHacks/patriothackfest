import { OtpLoginForm } from "@/components/otp-login-form"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams

  return (
    <main className="flex min-h-svh items-center justify-center bg-white p-4 sm:p-6">
      <OtpLoginForm sessionEnded={error === "session"} />
    </main>
  )
}
