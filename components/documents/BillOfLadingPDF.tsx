import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 30,
    borderBottom: "3 solid #000",
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  companyInfo: {
    fontSize: 9,
    textAlign: "center",
    color: "#666",
    marginBottom: 15,
  },
  billNumber: {
    fontSize: 12,
    textAlign: "right",
    fontFamily: "Courier",
    marginTop: 10,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 8,
    backgroundColor: "#f0f0f0",
    padding: 5,
  },
  twoColumn: {
    flexDirection: "row",
    marginBottom: 15,
  },
  leftColumn: {
    width: "50%",
    paddingRight: 15,
  },
  rightColumn: {
    width: "50%",
    paddingLeft: 15,
  },
  row: {
    marginBottom: 8,
  },
  label: {
    fontSize: 8,
    color: "#666",
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    fontWeight: "bold",
  },
  table: {
    marginTop: 15,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#000",
    color: "#fff",
    padding: 8,
    fontWeight: "bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottom: "1 solid #eee",
    fontSize: 9,
  },
  colQty: {
    width: "10%",
    textAlign: "right",
  },
  colDescription: {
    width: "40%",
  },
  colLot: {
    width: "20%",
    fontFamily: "Courier",
  },
  colWeight: {
    width: "15%",
    textAlign: "right",
  },
  colValue: {
    width: "15%",
    textAlign: "right",
  },
  signatureSection: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: {
    width: "45%",
    borderTop: "1 solid #000",
    paddingTop: 5,
    marginTop: 40,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#666",
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTop: "1 solid #ccc",
    fontSize: 8,
    color: "#666",
    textAlign: "center",
  },
})

interface BillOfLadingPDFProps {
  order: {
    id: string
    po_number?: string | null
    delivery_date: Date | string
    customer: {
      name: string
      code: string
      address?: string | null
      contact_email?: string | null
    }
    items: Array<{
      id: string
      quantity_ordered: number
      product: {
        name: string
        sku: string
        unit_type: string
        standard_case_weight?: number | null
      }
      allocations?: Array<{
        inventory_lot: {
          lot_number: string
        }
        quantity_allocated: number
      }>
    }>
  }
  companySettings: {
    name: string
    address: string
  }
  carrier?: {
    name?: string
    proNumber?: string
    trailerNumber?: string
  }
}

export function BillOfLadingPDF({
  order,
  companySettings,
  carrier,
}: BillOfLadingPDFProps) {
  const deliveryDate = new Date(order.delivery_date)
  const formattedDate = deliveryDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const billNumber = order.po_number || order.id.slice(0, 8).toUpperCase()

  // Calculate totals
  const totalQuantity = order.items.reduce(
    (sum, item) => sum + item.quantity_ordered,
    0
  )
  const totalWeight = order.items.reduce((sum, item) => {
    const weight =
      item.product.standard_case_weight && item.product.unit_type === "CASE"
        ? item.product.standard_case_weight * item.quantity_ordered
        : 0
    return sum + weight
  }, 0)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>BILL OF LADING</Text>
          <Text style={styles.companyInfo}>
            {companySettings.name || "Fresh Produce Co."}
            {"\n"}
            {companySettings.address || "123 Farm Road, CA 90210"}
          </Text>
          <Text style={styles.billNumber}>BOL #: {billNumber}</Text>
        </View>

        {/* Shipper and Consignee */}
        <View style={styles.section}>
          <View style={styles.twoColumn}>
            <View style={styles.leftColumn}>
              <Text style={styles.sectionTitle}>SHIPPER</Text>
              <View style={styles.row}>
                <Text style={styles.value}>
                  {companySettings.name || "Fresh Produce Co."}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.value}>
                  {companySettings.address || "123 Farm Road, CA 90210"}
                </Text>
              </View>
            </View>

            <View style={styles.rightColumn}>
              <Text style={styles.sectionTitle}>CONSIGNEE</Text>
              <View style={styles.row}>
                <Text style={styles.value}>
                  {order.customer.name} ({order.customer.code})
                </Text>
              </View>
              {order.customer.address && (
                <View style={styles.row}>
                  <Text style={styles.value}>{order.customer.address}</Text>
                </View>
              )}
              {order.customer.contact_email && (
                <View style={styles.row}>
                  <Text style={styles.value}>
                    {order.customer.contact_email}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Shipping Information */}
        <View style={styles.section}>
          <View style={styles.twoColumn}>
            <View style={styles.leftColumn}>
              <Text style={styles.sectionTitle}>SHIPMENT DETAILS</Text>
              <View style={styles.row}>
                <Text style={styles.label}>PO Number:</Text>
                <Text style={styles.value}>
                  {order.po_number || "N/A"}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Delivery Date:</Text>
                <Text style={styles.value}>{formattedDate}</Text>
              </View>
            </View>

            {carrier && (
              <View style={styles.rightColumn}>
                <Text style={styles.sectionTitle}>CARRIER INFORMATION</Text>
              {carrier.name && (
                <View style={styles.row}>
                  <Text style={styles.label}>Carrier:</Text>
                  <Text style={styles.value}>{carrier.name}</Text>
                </View>
              )}
              {carrier.proNumber && (
                <View style={styles.row}>
                  <Text style={styles.label}>Pro Number:</Text>
                  <Text style={styles.value}>{carrier.proNumber}</Text>
                </View>
              )}
              {carrier.trailerNumber && (
                <View style={styles.row}>
                  <Text style={styles.label}>Trailer #:</Text>
                  <Text style={styles.value}>{carrier.trailerNumber}</Text>
                </View>
              )}
              </View>
            )}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SHIPMENT CONTENTS</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.colQty}>Qty</Text>
              <Text style={styles.colDescription}>Description</Text>
              <Text style={styles.colLot}>Lot #</Text>
              <Text style={styles.colWeight}>Weight (lbs)</Text>
              <Text style={styles.colValue}>Value</Text>
            </View>

            {/* Table Rows */}
            {order.items.map((item) => {
              const weight =
                item.product.standard_case_weight &&
                item.product.unit_type === "CASE"
                  ? item.product.standard_case_weight * item.quantity_ordered
                  : null

              // Get lot numbers from allocations if available
              const lotNumbers = item.allocations
                ?.map((alloc) => alloc.inventory_lot.lot_number)
                .join(", ") || "N/A"

              return (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={styles.colQty}>{item.quantity_ordered}</Text>
                  <Text style={styles.colDescription}>
                    {item.product.name} ({item.product.sku})
                  </Text>
                  <Text style={styles.colLot}>{lotNumbers}</Text>
                  <Text style={styles.colWeight}>
                    {weight ? weight.toFixed(2) : "-"}
                  </Text>
                  <Text style={styles.colValue}>-</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.section}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <View style={{ width: "30%", alignItems: "flex-end" }}>
              <View style={styles.row}>
                <Text style={styles.label}>Total Quantity:</Text>
                <Text style={[styles.value, { marginLeft: 10 }]}>
                  {totalQuantity}
                </Text>
              </View>
              {totalWeight > 0 && (
                <View style={styles.row}>
                  <Text style={styles.label}>Total Weight:</Text>
                  <Text style={[styles.value, { marginLeft: 10 }]}>
                    {totalWeight.toFixed(2)} lbs
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Shipper Signature</Text>
            <Text style={styles.signatureLabel}>(Date)</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Consignee Signature</Text>
            <Text style={styles.signatureLabel}>(Date)</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            This is a system-generated Bill of Lading. BOL #{billNumber}
          </Text>
          <Text style={{ marginTop: 5 }}>
            Generated on {new Date().toLocaleString()}
          </Text>
        </View>
      </Page>
    </Document>
  )
}


