import { AuthTextButton } from "@/components/auth/auth-fields"
import { signOut } from "@/lib/auth-actions"

export function SignOutLink() {
  return (
    <form action={signOut} className="mt-8 text-center">
      <AuthTextButton type="submit" className="text-[#6E6E68]">
        Sign out
      </AuthTextButton>
    </form>
  )
}
