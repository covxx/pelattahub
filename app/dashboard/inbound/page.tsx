import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { InboundView } from "@/components/receiving/InboundView"
import { getActiveProducts } from "@/app/actions/products"

export default async function InboundPage() {
  const session = await auth()

  // Security check: Only receivers and admins can access
  if (!session?.user || (session.user.role !== "RECEIVER" && session.user.role !== "ADMIN")) {
    redirect("/")
  }

  const products = await getActiveProducts()

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Inbound / Receiving</h1>
        <p className="text-muted-foreground mt-1">
          Receive new inventory lots and print labels
        </p>
      </div>

      <InboundView products={products} />
    </div>
  )
}

