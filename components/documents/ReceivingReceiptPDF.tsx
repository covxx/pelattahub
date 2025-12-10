import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer"

// Register fonts if needed (optional)
// Font.register({
//   family: "Roboto",
//   src: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf",
// })

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 12,
    borderBottom: "1.5 solid #000",
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  companyInfo: {
    flex: 1,
  },
  logoContainer: {
    width: 220,
    height: 110,
    marginBottom: 8,
  },
  logo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  companyDetails: {
    fontSize: 8,
    color: "#666",
    lineHeight: 1.4,
  },
  receiptInfo: {
    textAlign: "right",
    minWidth: 150,
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#000",
  },
  receiptNumber: {
    fontSize: 11,
    fontFamily: "Courier",
    color: "#333",
  },
  detailsSection: {
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailsLeft: {
    width: "48%",
  },
  detailsRight: {
    width: "48%",
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 4,
    fontSize: 8,
  },
  detailLabel: {
    fontWeight: "bold",
    color: "#444",
    width: "40%",
  },
  detailValue: {
    color: "#000",
    width: "60%",
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 6,
    borderBottom: "1 solid #333",
    paddingBottom: 3,
    color: "#000",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
    paddingBottom: 3,
    borderBottom: "0.5 solid #eee",
  },
  label: {
    width: "35%",
    fontWeight: "bold",
    color: "#444",
    fontSize: 8,
  },
  value: {
    width: "65%",
    fontSize: 8,
    color: "#000",
  },
  table: {
    marginTop: 8,
    border: "1 solid #ddd",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: 6,
    fontWeight: "bold",
    fontSize: 8,
    borderBottom: "1.5 solid #333",
  },
  tableRow: {
    flexDirection: "row",
    padding: 5,
    borderBottom: "0.5 solid #eee",
    fontSize: 8,
    backgroundColor: "#fff",
  },
  colLot: {
    width: "20%",
    fontFamily: "Courier",
  },
  colProduct: {
    width: "30%",
  },
  colSku: {
    width: "15%",
    fontFamily: "Courier",
  },
  colQty: {
    width: "12%",
    textAlign: "right",
  },
  colUnit: {
    width: "10%",
  },
  colWeight: {
    width: "13%",
    textAlign: "right",
  },
  footer: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1 solid #ccc",
    fontSize: 7,
    color: "#666",
    textAlign: "center",
  },
  totalRow: {
    flexDirection: "row",
    marginTop: 5,
    paddingTop: 6,
    borderTop: "1.5 solid #000",
    fontWeight: "bold",
    fontSize: 9,
  },
})

interface ReceivingReceiptPDFProps {
  receivingEvent: {
    id: string
    receipt_number?: number
    received_date: Date | string
    vendor: {
      name: string
      code: string
      address?: string | null
      contact_email?: string | null
    }
    user?: {
      name: string | null
    }
    lots: Array<{
      id: string
      lot_number: string
      original_quantity: number
      quantity_current: number
      product: {
        sku: string
        name: string
        unit_type: string
        variety?: string | null
        standard_case_weight?: number | null
      }
    }>
  }
  companySettings: {
    name: string
    address: string
    logo_url?: string
  }
}

export function ReceivingReceiptPDF({
  receivingEvent,
  companySettings,
}: ReceivingReceiptPDFProps) {
  // Validate required data
  if (!receivingEvent) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View>
            <Text style={{ color: "red", fontSize: 12 }}>
              Error: No receiving event data provided
            </Text>
          </View>
        </Page>
      </Document>
    )
  }

  if (!receivingEvent.vendor) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View>
            <Text style={{ color: "red", fontSize: 12 }}>
              Error: Missing vendor information
            </Text>
          </View>
        </Page>
      </Document>
    )
  }

  if (!receivingEvent.lots || receivingEvent.lots.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View>
            <Text style={{ color: "red", fontSize: 12 }}>
              Error: No lots found in receiving event
            </Text>
          </View>
        </Page>
      </Document>
    )
  }

  try {
    const receivedDate = new Date(receivingEvent.received_date)
    const formattedDate = receivedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    const receiptNumber = receivingEvent.receipt_number?.toString() || "UNKNOWN"

    // Calculate totals
    const totalQuantity = receivingEvent.lots.reduce(
      (sum, lot) => sum + (lot.original_quantity || 0),
      0
    )
    const totalWeight = receivingEvent.lots.reduce((sum, lot) => {
      const product = lot.product || {}
      const standardCaseWeight = product.standard_case_weight ?? null
      const unitType = product.unit_type || "CASE"
      
      const weight =
        standardCaseWeight && unitType === "CASE"
          ? standardCaseWeight * (lot.original_quantity || 0)
          : 0
      return sum + weight
    }, 0)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.companyInfo}>
              {companySettings.logo_url && (
                <View style={styles.logoContainer}>
                  <Image
                    src={companySettings.logo_url}
                    style={styles.logo}
                  />
                </View>
              )}
              <Text style={styles.companyName}>
                {companySettings.name || "Fresh Produce Co."}
              </Text>
              <Text style={styles.companyDetails}>
                {companySettings.address || "123 Farm Road, CA 90210"}
              </Text>
            </View>
            <View style={styles.receiptInfo}>
              <Text style={styles.receiptTitle}>RECEIVING RECEIPT</Text>
              <Text style={styles.receiptNumber}>#{receiptNumber}</Text>
            </View>
          </View>
        </View>

        {/* Compact Details Section - Two Columns */}
        <View style={styles.detailsSection}>
          <View style={styles.detailsLeft}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Vendor:</Text>
              <Text style={styles.detailValue}>
                {receivingEvent.vendor.name} ({receivingEvent.vendor.code})
              </Text>
            </View>
            {receivingEvent.vendor.address && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address:</Text>
                <Text style={styles.detailValue}>{receivingEvent.vendor.address}</Text>
              </View>
            )}
            {receivingEvent.vendor.contact_email && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Contact:</Text>
                <Text style={styles.detailValue}>
                  {receivingEvent.vendor.contact_email}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.detailsRight}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date:</Text>
              <Text style={styles.detailValue}>{formattedDate}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Received By:</Text>
              <Text style={styles.detailValue}>
                {receivingEvent.user?.name || "Unknown"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Items:</Text>
              <Text style={styles.detailValue}>{receivingEvent.lots.length} lot(s)</Text>
            </View>
          </View>
        </View>

        {/* Items Table - Takes up remaining space */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Received</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.colLot}>Lot #</Text>
              <Text style={styles.colProduct}>Product</Text>
              <Text style={styles.colSku}>SKU</Text>
              <Text style={styles.colQty}>Qty</Text>
              <Text style={styles.colUnit}>Unit</Text>
              <Text style={styles.colWeight}>Weight (lbs)</Text>
            </View>

            {/* Table Rows */}
            {receivingEvent.lots.map((lot) => {
              // Safely access product fields with fallbacks
              const product = lot.product || {}
              const standardCaseWeight = product.standard_case_weight ?? null
              const unitType = product.unit_type || "CASE"
              
              const weight =
                standardCaseWeight && unitType === "CASE"
                  ? standardCaseWeight * (lot.original_quantity || 0)
                  : null

              return (
                <View key={lot.id} style={styles.tableRow}>
                  <Text style={styles.colLot}>{lot.lot_number || "N/A"}</Text>
                  <Text style={styles.colProduct}>
                    {product.name || "Unknown Product"}
                    {product.variety && ` (${product.variety})`}
                  </Text>
                  <Text style={styles.colSku}>{product.sku || "N/A"}</Text>
                  <Text style={styles.colQty}>{lot.original_quantity || 0}</Text>
                  <Text style={styles.colUnit}>{unitType}</Text>
                  <Text style={styles.colWeight}>
                    {weight ? weight.toFixed(2) : "-"}
                  </Text>
                </View>
              )
            })}

            {/* Total Row */}
            <View style={styles.totalRow}>
              <Text style={{ width: "65%" }}>TOTAL</Text>
              <Text style={styles.colQty}>{totalQuantity}</Text>
              <Text style={styles.colUnit}></Text>
              <Text style={styles.colWeight}>
                {totalWeight > 0 ? totalWeight.toFixed(2) : "-"}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            This is a system-generated receipt. Receipt #{receiptNumber}
          </Text>
          <Text style={{ marginTop: 5 }}>
            Generated on {new Date().toLocaleString()}
          </Text>
        </View>
      </Page>
    </Document>
    )
  } catch (error) {
    // Error fallback - show error message in PDF
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View>
            <Text style={{ color: "red", fontSize: 12, marginBottom: 10 }}>
              Error generating PDF:
            </Text>
            <Text style={{ fontSize: 10, color: "#666" }}>
              {error instanceof Error ? error.message : "Unknown error"}
            </Text>
            <Text style={{ fontSize: 8, color: "#999", marginTop: 20 }}>
              Receipt ID: {receivingEvent.id || "Unknown"}
            </Text>
          </View>
        </Page>
      </Document>
    )
  }
}

