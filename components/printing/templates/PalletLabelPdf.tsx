import React from 'react'
import { Document, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { BaseLabel } from '../BaseLabel'
import { format } from 'date-fns'
import { generateBarcodeDataUrl, formatGS1Barcode, padGTIN } from '@/lib/barcode-generator'

/**
 * Pallet Label PDF Template
 * 
 * 4x6 inch label optimized for vertical space
 * Layout:
 * - Header: "PALLET LABEL" banner
 * - Product name (large, bold)
 * - Vendor name
 * - Total quantity
 * - Received date
 * - Lot number
 * - Barcode at bottom (GS1-128 or Code 128)
 */

interface PalletLabelData {
  lot: {
    lot_number: string
    received_date: Date | string
    original_quantity?: number
    quantity_current?: number
    receivingEvent?: {
      vendor?: {
        name: string
        code?: string
      }
    }
  }
  product: {
    name: string
    unit_type?: string
    gtin?: string
  }
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#000',
    color: '#fff',
    padding: 8,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    flex: 1,
  },
  productName: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000',
  },
  infoRow: {
    fontSize: 18,
    marginBottom: 10,
    color: '#333',
  },
  label: {
    fontWeight: 'bold',
    marginRight: 8,
  },
  barcodeContainer: {
    marginTop: 'auto',
    paddingTop: 20,
    alignItems: 'center',
  },
  barcodeImage: {
    width: 200,
    height: 80,
    marginBottom: 8,
  },
  barcodeText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
  },
})


export function PalletLabelPdf({ lot, product }: PalletLabelData) {
  const lotNumber = lot.lot_number
  const productName = product.name
  const receivedDate = new Date(lot.received_date)
  const receivedDateDisplay = format(receivedDate, 'MM/dd/yyyy')
  
  // Get quantity (prefer original_quantity, fallback to quantity_current)
  const totalQuantity = lot.original_quantity ?? lot.quantity_current ?? 0
  const unitType = product.unit_type || 'CASE'
  const quantityDisplay = `${totalQuantity} ${unitType}`
  
  // Get vendor name
  const vendorName = lot.receivingEvent?.vendor?.name || 'Unknown Vendor'
  const vendorCode = lot.receivingEvent?.vendor?.code || ''

  // Generate barcode data
  // If GTIN is available, use GS1-128 format (preferred for warehouse operations)
  // Otherwise, use simple Code 128 with lot number
  let barcodeData: string
  let barcodeHRI: string
  
  if (product.gtin) {
    const gtin = padGTIN(product.gtin)
    // GS1-128 format: (01){gtin}(10){lotNumber}
    barcodeData = formatGS1Barcode(gtin, lotNumber)
    barcodeHRI = `(01) ${gtin} (10) ${lotNumber}`
  } else {
    // Fallback: Simple Code 128 with lot number only
    barcodeData = lotNumber
    barcodeHRI = lotNumber
  }

  // Generate barcode image (client-side only)
  // This will be generated when the PDF is rendered in the browser
  const barcodeImageUrl = generateBarcodeDataUrl(barcodeData, 'CODE128')

  return (
    <Document>
      <BaseLabel width={4} height={6}>
        <View style={styles.header}>
          <Text>PALLET LABEL</Text>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.productName}>{productName}</Text>
          
          <Text style={styles.infoRow}>
            <Text style={styles.label}>Vendor:</Text>
            {vendorName}
            {vendorCode && ` (${vendorCode})`}
          </Text>
          
          <Text style={styles.infoRow}>
            <Text style={styles.label}>Total:</Text>
            {quantityDisplay}
          </Text>
          
          <Text style={styles.infoRow}>
            <Text style={styles.label}>Received:</Text>
            {receivedDateDisplay}
          </Text>
          
          <Text style={styles.infoRow}>
            <Text style={styles.label}>Lot Number:</Text>
            {lotNumber}
          </Text>
          
          <View style={styles.barcodeContainer}>
            {barcodeImageUrl ? (
              <>
                <Image src={barcodeImageUrl} style={styles.barcodeImage} />
                <Text style={styles.barcodeText}>{barcodeHRI}</Text>
              </>
            ) : (
              <Text style={styles.barcodeText}>{barcodeHRI}</Text>
            )}
          </View>
        </View>
      </BaseLabel>
    </Document>
  )
}
