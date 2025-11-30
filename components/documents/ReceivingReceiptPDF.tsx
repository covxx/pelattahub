import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"

// Register fonts if needed (optional)
// Font.register({
//   family: "Roboto",
//   src: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf",
// })

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 30,
    borderBottom: "2 solid #000",
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
  },
  companyDetails: {
    fontSize: 9,
    color: "#666",
    lineHeight: 1.5,
  },
  receiptInfo: {
    marginTop: 10,
    textAlign: "right",
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  receiptNumber: {
    fontSize: 12,
    fontFamily: "Courier",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
    borderBottom: "1 solid #ccc",
    paddingBottom: 5,
  },
  row: {
    flexDirection: "row",
    marginBottom: 8,
  },
  label: {
    width: "30%",
    fontWeight: "bold",
    color: "#666",
  },
  value: {
    width: "70%",
  },
  table: {
    marginTop: 15,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    padding: 8,
    fontWeight: "bold",
    fontSize: 9,
    borderBottom: "1 solid #ccc",
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottom: "1 solid #eee",
    fontSize: 9,
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
    marginTop: 30,
    paddingTop: 15,
    borderTop: "1 solid #ccc",
    fontSize: 8,
    color: "#666",
    textAlign: "center",
  },
  totalRow: {
    flexDirection: "row",
    marginTop: 10,
    paddingTop: 10,
    borderTop: "2 solid #000",
    fontWeight: "bold",
  },
})

interface ReceivingReceiptPDFProps {
  receivingEvent: {
    id: string
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
    const receiptNumber = receivingEvent.id?.slice(0, 8).toUpperCase() || "UNKNOWN"

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
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
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

        {/* Vendor Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vendor Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Vendor Name:</Text>
            <Text style={styles.value}>
              {receivingEvent.vendor.name} ({receivingEvent.vendor.code})
            </Text>
          </View>
          {receivingEvent.vendor.address && (
            <View style={styles.row}>
              <Text style={styles.label}>Address:</Text>
              <Text style={styles.value}>{receivingEvent.vendor.address}</Text>
            </View>
          )}
          {receivingEvent.vendor.contact_email && (
            <View style={styles.row}>
              <Text style={styles.label}>Contact:</Text>
              <Text style={styles.value}>
                {receivingEvent.vendor.contact_email}
              </Text>
            </View>
          )}
        </View>

        {/* Receiving Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receiving Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Date Received:</Text>
            <Text style={styles.value}>{formattedDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Received By:</Text>
            <Text style={styles.value}>
              {receivingEvent.user?.name || "Unknown"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Items:</Text>
            <Text style={styles.value}>{receivingEvent.lots.length} lot(s)</Text>
          </View>
        </View>

        {/* Items Table */}
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

