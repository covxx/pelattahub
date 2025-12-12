"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { FileDown, Loader2, RefreshCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer"
import type { RecallLotSummary, RecallReportResult } from "@/app/actions/admin/recall"

type Props = {
  initialType: "lot" | "order"
  initialValue: string
  report: RecallReportResult | null
}

const styles = StyleSheet.create({
  page: { padding: 24 },
  heading: { fontSize: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 12, marginTop: 12, marginBottom: 4 },
  text: { fontSize: 10, marginBottom: 2 },
  row: { flexDirection: "row", justifyContent: "space-between" },
})

export function RecallReport({ initialType, initialValue, report }: Props) {
  const router = useRouter()
  const [lookupType, setLookupType] = useState<"lot" | "order">(initialType)
  const [value, setValue] = useState(initialValue)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  const found = Boolean(report)

  const formatDate = (dateString?: string) =>
    dateString ? format(new Date(dateString), "MM/dd/yyyy") : "—"

  const rowsForExport = useMemo(() => {
    if (!report) return []

    const buildRowsFromLot = (lot: RecallLotSummary) => {
      if (lot.orders.length === 0) {
        return [
          {
            lotNumber: lot.lotNumber,
            product: lot.productName,
            vendor: lot.vendorName ?? "",
            received: formatDate(lot.receivedDate),
            orderNumber: "",
            customer: "",
            delivery: "",
            quantity: "",
            production: lot.productionRuns.length > 0 ? "Yes" : "No",
          },
        ]
      }

      return lot.orders.map((order) => ({
        lotNumber: lot.lotNumber,
        product: lot.productName,
        vendor: lot.vendorName ?? "",
        received: formatDate(lot.receivedDate),
        orderNumber: order.orderNumber ?? order.poNumber ?? "N/A",
        customer: order.customerName,
        delivery: formatDate(order.deliveryDate),
        quantity: `${order.quantityPicked} ${order.unitType}`,
        production: lot.productionRuns.length > 0 ? "Yes" : "No",
      }))
    }

    if (report.mode === "lot") {
      return buildRowsFromLot(report.lot)
    }

    return report.lots.flatMap((lot) => buildRowsFromLot(lot))
  }, [report])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    params.set("type", lookupType)
    if (value) {
      params.set("value", value.trim())
    }
    router.push(`/dashboard/admin/recall?${params.toString()}`)
  }

  const downloadCsv = () => {
    if (!report) return
    setExportingCsv(true)
    try {
      const headers = [
        "Lot Number",
        "Product",
        "Vendor",
        "Received Date",
        "Order/PO",
        "Customer",
        "Delivery Date",
        "Quantity",
        "Production Transform",
      ]
      const escape = (val: string) => `"${(val || "").replace(/"/g, '""')}"`

      const csvBody = rowsForExport
        .map((row) =>
          [
            row.lotNumber,
            row.product,
            row.vendor,
            row.received,
            row.orderNumber,
            row.customer,
            row.delivery,
            row.quantity,
            row.production,
          ]
            .map(escape)
            .join(",")
        )
        .join("\n")

      const blob = new Blob([`${headers.join(",")}\n${csvBody}`], {
        type: "text/csv",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `recall-report-${lookupType}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportingCsv(false)
    }
  }

  const downloadPdf = async () => {
    if (!report) return
    setExportingPdf(true)
    try {
      const doc = (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.heading}>Recall Report</Text>
            <Text style={styles.text}>Type: {report.mode === "lot" ? "Lot" : "Order"}</Text>
            <Text style={styles.text}>
              Reference:{" "}
              {report.mode === "lot"
                ? report.lot.lotNumber
                : report.order.orderNumber ?? report.order.poNumber ?? "N/A"}
            </Text>

            <Text style={styles.sectionTitle}>Lots</Text>
            {report.mode === "lot"
              ? renderLotSection(report.lot)
              : report.lots.map((lot) => (
                  <View key={lot.id} wrap={false}>
                    {renderLotSection(lot)}
                  </View>
                ))}

            <Text style={styles.sectionTitle}>Audit Trail (latest 50)</Text>
            {report.auditTrail.map((log) => (
              <Text key={log.id} style={styles.text}>
                [{formatDate(log.createdAt)}] {log.action} — {log.summary ?? "No summary"} (
                {log.user.email})
              </Text>
            ))}
          </Page>
        </Document>
      )

      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `recall-report-${lookupType}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportingPdf(false)
    }
  }

  const renderLotSection = (lot: RecallLotSummary) => (
    <View key={lot.id} wrap={false} style={{ marginBottom: 8 }}>
      <Text style={styles.text}>
        Lot {lot.lotNumber} • {lot.productName} ({lot.productSku})
      </Text>
      <Text style={styles.text}>
        Vendor {lot.vendorName ?? "N/A"} | Received {formatDate(lot.receivedDate)} | Status{" "}
        {lot.status}
      </Text>
      <Text style={styles.text}>Orders: {lot.orders.length} • Production runs: {lot.productionRuns.length}</Text>
    </View>
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Run a recall</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end" onSubmit={handleSearch}>
            <div className="space-y-2">
              <Label>Lookup type</Label>
              <Select value={lookupType} onValueChange={(v) => setLookupType(v as "lot" | "order")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lot">Lot</SelectItem>
                  <SelectItem value="order">Order</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{lookupType === "lot" ? "Lot number" : "Order number / PO"}</Label>
              <Input
                placeholder={lookupType === "lot" ? "e.g., LOT-1234" : "e.g., SO-1001 or PO-88"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit">
                <RefreshCcw className="h-4 w-4 mr-2" />
                Generate
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!found || exportingCsv}
                onClick={downloadCsv}
              >
                {exportingCsv ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!found || exportingPdf}
                onClick={downloadPdf}
              >
                {exportingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                PDF
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!value && (
        <Card>
          <CardContent className="py-8 text-muted-foreground text-sm">
            Enter a lot number or order number to generate a recall report.
          </CardContent>
        </Card>
      )}

      {value && !found && (
        <Card>
          <CardContent className="py-8 text-red-600 text-sm">
            No records found for "{value}".
          </CardContent>
        </Card>
      )}

      {found && report && (
        <div className="space-y-4">
          {report.mode === "lot" ? (
            <LotSection lot={report.lot} formatDate={formatDate} />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Order</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-4">
                    <Badge variant="secondary">
                      Order/PO: {report.order.orderNumber ?? report.order.poNumber ?? "N/A"}
                    </Badge>
                    <Badge variant="outline">Customer: {report.order.customerName}</Badge>
                    <Badge variant="outline">Delivery: {formatDate(report.order.deliveryDate)}</Badge>
                  </div>
                </CardContent>
              </Card>
              {report.lots.map((lot) => (
                <LotSection key={lot.id} lot={lot} formatDate={formatDate} />
              ))}
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Audit trail (latest 50)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.auditTrail.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground text-sm">
                        No audit entries found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.auditTrail.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">{formatDate(log.createdAt)}</TableCell>
                        <TableCell className="text-sm">{log.action}</TableCell>
                        <TableCell className="text-sm">{log.user.email}</TableCell>
                        <TableCell className="text-sm">{log.summary ?? "No summary"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function LotSection({
  lot,
  formatDate,
}: {
  lot: RecallLotSummary
  formatDate: (date?: string) => string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Lot {lot.lotNumber} — {lot.productName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary">Status: {lot.status}</Badge>
          <Badge variant="outline">Vendor: {lot.vendorName ?? "N/A"}</Badge>
          <Badge variant="outline">Received: {formatDate(lot.receivedDate)}</Badge>
          <Badge variant="outline">Expiry: {formatDate(lot.expiryDate)}</Badge>
          <Badge variant="outline">Origin: {lot.originCountry}</Badge>
          <Badge variant="outline">
            Production transforms: {lot.productionRuns.length > 0 ? "Yes" : "No"}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="font-medium">Downstream orders</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order/PO</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Quantity Picked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lot.orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-sm">
                    No orders found for this lot.
                  </TableCell>
                </TableRow>
              ) : (
                lot.orders.map((order) => (
                  <TableRow key={order.orderId}>
                    <TableCell className="text-sm">
                      {order.orderNumber ?? order.poNumber ?? "N/A"}
                    </TableCell>
                    <TableCell className="text-sm">{order.customerName}</TableCell>
                    <TableCell className="text-sm">{formatDate(order.deliveryDate)}</TableCell>
                    <TableCell className="text-sm">
                      {order.quantityPicked} {order.unitType}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2">
          <div className="font-medium">Production transforms</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Peer Lot</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lot.productionRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-sm">
                    No production transforms found.
                  </TableCell>
                </TableRow>
              ) : (
                lot.productionRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm">
                      <Badge variant="secondary">
                        {run.direction === "SOURCE" ? "Consumed from" : "Produced into"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.peerLotNumber ?? "N/A"} {run.peerProductName ? `(${run.peerProductName})` : ""}
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.direction === "SOURCE" ? run.quantityConsumed ?? 0 : run.quantityProduced ?? 0}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(run.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
