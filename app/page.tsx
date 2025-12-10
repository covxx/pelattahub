import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function Home() {
  const session = await auth()

  // If user is logged in, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard/inventory")
  }

  // Otherwise, redirect to login
  redirect("/login")
}
