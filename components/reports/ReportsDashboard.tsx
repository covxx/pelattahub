"use client"

import { useState, useTransition, useEffect } from "react"
import { format, subDays } from "date-fns"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { VendorCombobox } from "@/components/receiving/VendorCombobox"
import { CustomerCombobox } from "@/components/orders/CustomerCombobox"
import { ProductCombobox } from "@/components/receiving/ProductCombobox"
import { generateInboundReport, generateOutboundReport, getInventorySnapshot, checkDataHealth } from "@/app/actions/reports"
import * as XLSX from "@e965/xlsx"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Vendor, Customer, Product } from "@prisma/client"

interface ReportsDashboardProps {
  vendors: Vendor[]
  customers: Customer[]
  products: Product[]
}

type ReportTab = "inbound" | "outbound" | "inventory"
type GroupBy = "date" | "product" | "entity"

interface ChartDataPoint {
  date: string
  totalLbs: number
  totalCases: number
}

export function ReportsDashboard({
  vendors,
  customers,
  products,
}: ReportsDashboardProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>("inbound")
  const [isPending, startTransition] = useTransition()
  const [groupBy, setGroupBy] = useState<GroupBy>("date")

  // Date range state (default: last 30 days)
  const [startDate, setStartDate] = useState<string>(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  )
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"))

  // Filter state
  const [selectedVendorId, setSelectedVendorId] = useState<string>("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
  const [selectedProductId, setSelectedProductId] = useState<string>("")

  // Report data state
  const [inboundData, setInboundData] = useState<any>(null)
  const [outboundData, setOutboundData] = useState<any>(null)
  const [inventoryData, setInventoryData] = useState<any>(null)

  // Chart data state
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])

  // Table data state
  const [tableData, setTableData] = useState<any[]>([])

  // Data health state
  const [dataHealth, setDataHealth] = useState<{
    count: number
    products: Array<{ id: string; name: string; sku: string }>
    hasIssues: boolean
  } | null>(null)

  // Load data health on mount
  useEffect(() => {
    checkDataHealth().then(setDataHealth).catch(console.error)
  }, [])

  // Load initial data
  useEffect(() => {
    loadReportData()
  }, [activeTab, startDate, endDate, selectedVendorId, selectedCustomerId, selectedProductId, groupBy])

  const loadReportData = () => {
    startTransition(async () => {
      try {
        if (activeTab === "inbound") {
          const result = await generateInboundReport({
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            vendorId: selectedVendorId || undefined,
            productId: selectedProductId || undefined,
          })
          setInboundData(result)
          if (groupBy === "date") {
            processInboundDataForChart(result)
          } else {
            setChartData([])
          }
          processInboundDataForTable(result, groupBy)
        } else if (activeTab === "outbound") {
          const result = await generateOutboundReport({
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            customerId: selectedCustomerId || undefined,
            productId: selectedProductId || undefined,
          })
          setOutboundData(result)
          if (groupBy === "date") {
            processOutboundDataForChart(result)
          } else {
            setChartData([])
          }
          processOutboundDataForTable(result, groupBy)
        } else if (activeTab === "inventory") {
          const result = await getInventorySnapshot({
            productId: selectedProductId || undefined,
          })
          setInventoryData(result)
          // Inventory doesn't have date-based chart, so we'll show a different visualization
          processInventoryDataForTable(result)
        }
      } catch (error) {
        console.error("Error loading report data:", error)
      }
    })
  }

  const processInboundDataForChart = (data: any) => {
    // Use date-grouped data from the server
    if (data.byDate && data.byDate.length > 0) {
      const chartDataPoints: ChartDataPoint[] = data.byDate.map((item: any) => ({
        date: format(new Date(item.date), "MMM dd"),
        totalLbs: Math.round(item.totalLbs),
        totalCases: Math.round(item.totalCases),
      }))
      setChartData(chartDataPoints)
    } else {
      // Fallback to summary if no date data
      setChartData([
        {
          date: format(new Date(startDate), "MMM dd"),
          totalLbs: Math.round(data.summary.totalLbs),
          totalCases: Math.round(data.summary.totalCases),
        },
      ])
    }
  }

  const processOutboundDataForChart = (data: any) => {
    // Use date-grouped data from the server
    if (data.byDate && data.byDate.length > 0) {
      const chartDataPoints: ChartDataPoint[] = data.byDate.map((item: any) => ({
        date: format(new Date(item.date), "MMM dd"),
        totalLbs: Math.round(item.totalLbs),
        totalCases: Math.round(item.totalCases),
      }))
      setChartData(chartDataPoints)
    } else {
      // Fallback to summary if no date data
      setChartData([
        {
          date: format(new Date(startDate), "MMM dd"),
          totalLbs: Math.round(data.summary.totalLbs),
          totalCases: Math.round(data.summary.totalCases),
        },
      ])
    }
  }

  const processInboundDataForTable = (data: any, groupByMode: GroupBy) => {
    const rows: any[] = []

    if (groupByMode === "date") {
      // Group by date - chronological timeline
      if (data.byDate && data.byDate.length > 0) {
        data.byDate.forEach((dateItem: any) => {
          rows.push({
            date: format(new Date(dateItem.date), "yyyy-MM-dd"),
            entity: "All Vendors",
            product: "All Products",
            sku: "-",
            qtyCases: Math.round(dateItem.totalCases),
            estWeightLbs: Math.round(dateItem.totalLbs),
            unitType: "CASE", // Aggregated, assume CASE
            hasInvalidWeight: false, // Can't determine for aggregated data
          })
        })
      }
    } else if (groupByMode === "product") {
      // Group by product - aggregate totals per SKU
      data.byProduct.forEach((product: any) => {
        // Check if this product has invalid weight (CASE unit but no standard_case_weight)
        const hasInvalidWeight = product.unitType === "CASE" && product.totalLbs === 0 && product.totalCases > 0
        rows.push({
          date: `${format(new Date(startDate), "yyyy-MM-dd")} to ${format(new Date(endDate), "yyyy-MM-dd")}`,
          entity: "All Vendors",
          product: product.productName,
          sku: product.productSku,
          qtyCases: Math.round(product.totalCases),
          estWeightLbs: Math.round(product.totalLbs),
          unitType: product.unitType,
          hasInvalidWeight,
        })
      })
    } else if (groupByMode === "entity") {
      // Group by vendor - aggregate totals per entity
      data.byVendor.forEach((vendor: any) => {
        rows.push({
          date: `${format(new Date(startDate), "yyyy-MM-dd")} to ${format(new Date(endDate), "yyyy-MM-dd")}`,
          entity: vendor.vendorName,
          product: "All Products",
          sku: "-",
          qtyCases: Math.round(vendor.totalCases),
          estWeightLbs: Math.round(vendor.totalLbs),
          unitType: "CASE", // Aggregated, assume CASE
          hasInvalidWeight: false, // Can't determine for aggregated data
        })
      })
    }

    setTableData(rows)
  }

  const processOutboundDataForTable = (data: any, groupByMode: GroupBy) => {
    const rows: any[] = []

    if (groupByMode === "date") {
      // Group by date - chronological timeline
      if (data.byDate && data.byDate.length > 0) {
        data.byDate.forEach((dateItem: any) => {
          rows.push({
            date: format(new Date(dateItem.date), "yyyy-MM-dd"),
            entity: "All Customers",
            product: "All Products",
            sku: "-",
            qtyCases: Math.round(dateItem.totalCases),
            estWeightLbs: Math.round(dateItem.totalLbs),
            unitType: "CASE", // Aggregated, assume CASE
            hasInvalidWeight: false, // Can't determine for aggregated data
          })
        })
      }
    } else if (groupByMode === "product") {
      // Group by product - aggregate totals per SKU
      data.byProduct.forEach((product: any) => {
        // Check if this product has invalid weight (CASE unit but no standard_case_weight)
        const hasInvalidWeight = product.unitType === "CASE" && product.totalLbs === 0 && product.totalCases > 0
        rows.push({
          date: `${format(new Date(startDate), "yyyy-MM-dd")} to ${format(new Date(endDate), "yyyy-MM-dd")}`,
          entity: "All Customers",
          product: product.productName,
          sku: product.productSku,
          qtyCases: Math.round(product.totalCases),
          estWeightLbs: Math.round(product.totalLbs),
          unitType: product.unitType,
          hasInvalidWeight,
        })
      })
    } else if (groupByMode === "entity") {
      // Group by customer - aggregate totals per entity
      data.byCustomer.forEach((customer: any) => {
        rows.push({
          date: `${format(new Date(startDate), "yyyy-MM-dd")} to ${format(new Date(endDate), "yyyy-MM-dd")}`,
          entity: customer.customerName,
          product: "All Products",
          sku: "-",
          qtyCases: Math.round(customer.totalCases),
          estWeightLbs: Math.round(customer.totalLbs),
          unitType: "CASE", // Aggregated, assume CASE
          hasInvalidWeight: false, // Can't determine for aggregated data
        })
      })
    }

    setTableData(rows)
  }

  const processInventoryDataForTable = (data: any) => {
    const rows: any[] = []
    data.byProduct.forEach((product: any) => {
      rows.push({
        date: format(new Date(), "yyyy-MM-dd"),
        entity: "Current Inventory",
        product: product.productName,
        sku: product.productSku,
        qtyCases: 0, // Inventory snapshot doesn't track cases separately
        estWeightLbs: Math.round(product.totalLbs),
        totalLots: product.totalLots,
      })
    })
    setTableData(rows)
  }

  const handleExportToExcel = () => {
    const reportType = activeTab === "inbound" ? "Inbound" : activeTab === "outbound" ? "Outbound" : "Inventory"
    const groupByLabel = (activeTab === "inbound" || activeTab === "outbound") 
      ? (groupBy === "date" ? "ByDate" : groupBy === "product" ? "ByProduct" : "ByEntity")
      : ""
    const dateStr = format(new Date(), "yyyy-MM-dd")
    const filename = `WMS_Report_${reportType}${groupByLabel ? `_${groupByLabel}` : ""}_${dateStr}.xlsx`

    // Prepare data for Excel - matches current table view based on grouping
    let headers: string[] = []
    let excelData: any[] = []

    if (activeTab === "inventory") {
      // Inventory view
      headers = ["Date", "Entity", "Product", "SKU", "Qty", "Unit", "Total Lbs", "Total Lots"]
      excelData = tableData.map((row) => [
        row.date,
        row.entity,
        row.product,
        row.sku,
        row.qtyCases,
        "CASE",
        row.estWeightLbs,
        row.totalLots || 0,
      ])
    } else {
      // Inbound/Outbound views - columns depend on grouping
      if (groupBy === "date") {
        headers = ["Date", activeTab === "inbound" ? "Vendor" : "Customer", "Product", "SKU", "Qty", "Unit", "Total Lbs"]
        excelData = tableData.map((row) => [
          row.date,
          row.entity,
          row.product,
          row.sku,
          row.qtyCases,
          "CASE",
          row.estWeightLbs,
        ])
      } else if (groupBy === "product") {
        headers = ["Date Range", "Product", "SKU", "Qty", "Unit", "Total Lbs"]
        excelData = tableData.map((row) => [
          row.date,
          row.product,
          row.sku,
          row.qtyCases,
          "CASE",
          row.estWeightLbs,
        ])
      } else if (groupBy === "entity") {
        headers = ["Date Range", activeTab === "inbound" ? "Vendor" : "Customer", "Qty", "Unit", "Total Lbs"]
        excelData = tableData.map((row) => [
          row.date,
          row.entity,
          row.qtyCases,
          "CASE",
          row.estWeightLbs,
        ])
      }
    }

    const worksheetData = [headers, ...excelData]

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(worksheetData)

    // Set column widths dynamically based on headers
    const colWidths = headers.map((header, idx) => {
      if (header === "Date" || header === "Date Range") return { wch: 20 }
      if (header === "Vendor" || header === "Customer" || header === "Entity") return { wch: 25 }
      if (header === "Product") return { wch: 30 }
      if (header === "SKU") return { wch: 15 }
      if (header === "Qty" || header === "Unit") return { wch: 10 }
      if (header === "Total Lbs") return { wch: 12 }
      if (header === "Total Lots") return { wch: 12 }
      return { wch: 15 }
    })
    ws["!cols"] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, "Report")
    XLSX.writeFile(wb, filename)
  }

  return (
    <div className="space-y-6">
      {/* Data Health Banner */}
      {dataHealth && dataHealth.hasIssues && (
        <Alert variant="warning">
          <AlertTitle className="flex items-center gap-2">
            ⚠️ Data Integrity Warning
          </AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              {dataHealth.count} product{dataHealth.count !== 1 ? "s are" : " is"} configured as 'CASE' but missing a Standard Weight. Weight reports will be inaccurate.
            </p>
            {dataHealth.products.length > 0 && (
              <p className="text-sm mb-2">
                Affected products: {dataHealth.products.map((p) => p.name).join(", ")}
                {dataHealth.count > 5 && ` and ${dataHealth.count - 5} more...`}
              </p>
            )}
            <Link
              href="/dashboard/admin/products"
              className="text-sm font-medium underline hover:no-underline"
            >
              Fix Now →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            View and export warehouse activity reports
          </p>
        </div>
        {tableData.length > 0 && (
          <Button onClick={handleExportToExcel} disabled={isPending}>
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-6" aria-label="Report navigation">
          <button
            onClick={() => {
              setActiveTab("inbound")
              setGroupBy("date")
            }}
            className={`inline-flex items-center px-1 pt-1 pb-4 border-b-2 text-sm font-medium transition-colors ${
              activeTab === "inbound"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
            }`}
          >
            Inbound History
          </button>
          <button
            onClick={() => {
              setActiveTab("outbound")
              setGroupBy("date")
            }}
            className={`inline-flex items-center px-1 pt-1 pb-4 border-b-2 text-sm font-medium transition-colors ${
              activeTab === "outbound"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
            }`}
          >
            Outbound History
          </button>
          <button
            onClick={() => {
              setActiveTab("inventory")
              setGroupBy("date")
            }}
            className={`inline-flex items-center px-1 pt-1 pb-4 border-b-2 text-sm font-medium transition-colors ${
              activeTab === "inventory"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
            }`}
          >
            Current Inventory
          </button>
        </nav>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={activeTab === "inventory"}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={activeTab === "inventory"}
              />
            </div>

            {/* Vendor/Customer Select */}
            {activeTab === "inbound" && (
              <div className="space-y-2">
                <Label>Vendor</Label>
                <VendorCombobox
                  vendors={vendors}
                  value={selectedVendorId}
                  onValueChange={setSelectedVendorId}
                />
              </div>
            )}
            {activeTab === "outbound" && (
              <div className="space-y-2">
                <Label>Customer</Label>
                <CustomerCombobox
                  customers={customers}
                  value={selectedCustomerId}
                  onValueChange={setSelectedCustomerId}
                />
              </div>
            )}

            {/* Product Select */}
            <div className="space-y-2">
              <Label>Product</Label>
              <ProductCombobox
                products={products}
                value={selectedProductId}
                onValueChange={setSelectedProductId}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart - Only show for "By Date" grouping */}
      {(activeTab === "inbound" || activeTab === "outbound") && groupBy === "date" && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Total Weight (LBS) by Date</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: "Weight (LBS)", angle: -90, position: "insideLeft" }} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "totalLbs") {
                      return [`${value.toLocaleString()} LBS`, "Total Weight"]
                    }
                    if (name === "totalCases") {
                      return [`${value.toLocaleString()} Cases`, "Cases"]
                    }
                    return [value, name]
                  }}
                />
                <Legend />
                <Bar dataKey="totalLbs" fill="#8884d8" name="Total Weight (LBS)" />
                <Bar dataKey="totalCases" fill="#82ca9d" name="Cases" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {activeTab === "inbound" && inboundData && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Lots</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inboundData.summary.totalLots}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(inboundData.summary.totalCases).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Weight (LBS)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(inboundData.summary.totalLbs).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "outbound" && outboundData && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Picks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{outboundData.summary.totalPicks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(outboundData.summary.totalCases).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Weight (LBS)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(outboundData.summary.totalLbs).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "inventory" && inventoryData && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Lots</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventoryData.summary.totalLots}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Weight (LBS)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(inventoryData.summary.totalLbs).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Expiry Risk Lots</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {inventoryData.summary.expiryRiskLots}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Expiry Risk Weight (LBS)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(inventoryData.summary.expiryRiskLbs).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Group By Toggle - Only show for Inbound and Outbound tabs */}
      {(activeTab === "inbound" || activeTab === "outbound") && (
        <Card>
          <CardHeader>
            <CardTitle>Group By</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={groupBy === "date" ? "default" : "outline"}
                onClick={() => setGroupBy("date")}
                disabled={isPending}
              >
                View by Date
              </Button>
              <Button
                variant={groupBy === "product" ? "default" : "outline"}
                onClick={() => setGroupBy("product")}
                disabled={isPending}
              >
                View by Product
              </Button>
              <Button
                variant={groupBy === "entity" ? "default" : "outline"}
                onClick={() => setGroupBy("entity")}
                disabled={isPending}
              >
                View by {activeTab === "inbound" ? "Vendor" : "Customer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Report Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : tableData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {(activeTab === "inbound" || activeTab === "outbound") && groupBy !== "product" && (
                      <TableHead>
                        {activeTab === "inbound" ? "Vendor" : "Customer"}
                      </TableHead>
                    )}
                    {(activeTab === "inbound" || activeTab === "outbound") && groupBy !== "entity" && (
                      <>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                      </>
                    )}
                    <TableHead>Qty (Cases)</TableHead>
                    <TableHead>Est. Weight (LBS)</TableHead>
                    {activeTab === "inventory" && <TableHead>Total Lots</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.date}</TableCell>
                      {(activeTab === "inbound" || activeTab === "outbound") && groupBy !== "product" && (
                        <TableCell>{row.entity}</TableCell>
                      )}
                      {(activeTab === "inbound" || activeTab === "outbound") && groupBy !== "entity" && (
                        <>
                          <TableCell>{row.product}</TableCell>
                          <TableCell>{row.sku}</TableCell>
                        </>
                      )}
                      <TableCell>{row.qtyCases.toLocaleString()}</TableCell>
                      <TableCell
                        className={row.hasInvalidWeight ? "text-red-600 font-semibold" : ""}
                        title={row.hasInvalidWeight ? "Invalid: Product configured as CASE but missing Standard Weight" : ""}
                      >
                        {row.estWeightLbs.toLocaleString()}
                        {row.hasInvalidWeight && " ⚠️"}
                      </TableCell>
                      {activeTab === "inventory" && (
                        <TableCell>{row.totalLots || 0}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

