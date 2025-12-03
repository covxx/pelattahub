import { getOrderForPicking } from "@/app/actions/picking"
import { PickingInterface } from "@/components/picking/PickingInterface"
import { notFound } from "next/navigation"

interface PickingPageProps {
  params: {
    id: string
  }
}

export default async function PickingPage({ params }: PickingPageProps) {
  try {
    const order = await getOrderForPicking(params.id)
    return <PickingInterface order={order} />
  } catch (error) {
    console.error("Error loading order for picking:", error)
    notFound()
  }
}

