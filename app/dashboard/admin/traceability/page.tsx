import { TraceabilityExplorer } from "@/components/admin/TraceabilityExplorer"

export default async function TraceabilityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Traceability Explorer</h2>
        <p className="text-muted-foreground">
          Track product lifecycle from receiving to shipment
        </p>
      </div>

      <TraceabilityExplorer />
    </div>
  )
}


