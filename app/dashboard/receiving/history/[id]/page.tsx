import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { getReceivingEvent } from "@/app/actions/receiving"
import { ReceivingEventDetail } from "@/components/receiving/ReceivingEventDetail"

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ReceivingEventDetailPage(props: PageProps) {
  const params = await props.params
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const event = await getReceivingEvent(params.id)

  if (!event) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <ReceivingEventDetail event={event} userRole={session.user.role} />
    </div>
  )
}

