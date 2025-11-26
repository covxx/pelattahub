import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ReceivingForm } from "@/components/receiving/ReceivingForm"

export default async function ReceivingPage() {
  const session = await auth()

  // Security check: Only receivers and admins can access
  if (!session?.user || (session.user.role !== "RECEIVER" && session.user.role !== "ADMIN")) {
    redirect("/")
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Receive Inventory</h1>
        <p className="text-muted-foreground mt-1">
          Record new inventory lots and print GS1-128 labels
        </p>
      </div>

      <ReceivingForm />
    </div>
  )
}

