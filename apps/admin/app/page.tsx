import { redirect } from "next/navigation"

import { getAdmin } from "@/lib/admin"

export default async function Page() {
  await getAdmin()
  redirect("/forms")
}
