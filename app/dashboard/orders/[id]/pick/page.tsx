import { getOrderForPicking } from "@/app/actions/picking"
import { PickingInterface } from "@/components/picking/PickingInterface"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"

interface PickingPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PickingPage(props: PickingPageProps) {
  const params = await props.params
  const session = await auth()

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/orders")
  }

  // Only ADMIN, PACKER, and MANAGER can access picking
  if (session.user.role !== "ADMIN" && session.user.role !== "PACKER" && session.user.role !== "MANAGER") {
    redirect("/dashboard")
  }
  
  try {
    const order = await getOrderForPicking(params.id)
    return <PickingInterface order={order} />
  } catch (error) {
    console.error("Error loading order for picking:", error)
    notFound()
  }
}

