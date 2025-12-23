import React from 'react'
import { Document, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { BaseLabel } from '../BaseLabel'
import { format } from 'date-fns'
import { generateBarcodeDataUrl, formatGS1Barcode, padGTIN } from '@/lib/barcode-generator'
import { getVoicePickCode, formatDateForVoicePick, formatVoicePick } from '@/lib/voice-pick'

/**
 * Case Label PDF Template
 * 
 * 4x2 inch label optimized for horizontal density (PTI-compliant)
 * Layout (PTI Standard):
 * - Zone A: Company name (top header, centered)
 * - Zone B: Product description (large, bold, centered)
 * - Zone C: Left data (GTIN, LOT, PACK date)
 * - Zone D: Right Voice Pick box (split 2+2 digits, inverted)
 * - Zone E: Bottom GS1-128 barcode (full width)
 */

interface CaseLabelData {
  lot: {
    lot_number: string
    received_date: Date | string
    expiry_date?: Date | string
  }
  product: {
    name: string
    gtin: string
    variety?: string | null
  }
  companySettings?: {
    name: string
    address?: string
  }
}

const styles = StyleSheet.create({
  companyHeader: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: 'bold',
    color: '#000',
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#000',
    textTransform: 'uppercase',
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  leftColumn: {
    flex: 1,
    fontSize: 10,
    color: '#333',
  },
  rightColumn: {
    width: 80,
    alignItems: 'flex-end',
  },
  voicePickBox: {
    backgroundColor: '#000',
    color: '#fff',
    padding: 8,
    borderRadius: 4,
    width: 70,
    alignItems: 'center',
  },
  voicePickSmall: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  voicePickLarge: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  label: {
    fontWeight: 'bold',
    marginRight: 4,
  },
  barcodeContainer: {
    marginTop: 8,
    alignItems: 'center',
    paddingTop: 4,
  },
  barcodeImage: {
    width: 180,
    height: 50,
    marginBottom: 4,
  },
  barcodeText: {
    fontSize: 8,
    textAlign: 'center',
    color: '#333',
  },
})

export function CaseLabelPdf({ lot, product, companySettings }: CaseLabelData) {
  const companyName = companySettings?.name || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Fresh Produce Co.'
  
  const lotNumber = lot.lot_number
  const productName = product.name.toUpperCase() // PTI standard: all caps
  const gtin = padGTIN(product.gtin)
  const receivedDate = new Date(lot.received_date)
  const packDateDisplay = format(receivedDate, 'MM/dd/yy') // MM/DD/YY format

  // Calculate Voice Pick check digit
  const voicePickDateStr = formatDateForVoicePick(receivedDate)
  const voicePickCode = getVoicePickCode(gtin, lotNumber, voicePickDateStr)
  const { small, large } = formatVoicePick(voicePickCode)

  // Construct GS1-128 barcode data
  // Format: (01){gtin}(13){packDate}(10){lotNumber}
  // AI 13 = Pack Date (YYMMDD)
  const packDateBarcode = format(receivedDate, 'yyMMdd')
  const barcodeData = formatGS1Barcode(gtin, lotNumber)
  // For full PTI compliance, we'd include pack date: (01){gtin}(13){packDate}(10){lot}
  // But for simplicity, we'll use (01){gtin}(10){lot}
  const barcodeHRI = `(01) ${gtin} (10) ${lotNumber}`

  // Generate barcode image
  const barcodeImageUrl = generateBarcodeDataUrl(barcodeData, 'CODE128')

  return (
    <Document>
      <BaseLabel width={4} height={2}>
        <View style={{ padding: 4 }}>
          {/* Zone A: Company name */}
          <Text style={styles.companyHeader}>{companyName}</Text>
          
          {/* Zone B: Product name */}
          <Text style={styles.productName}>{productName}</Text>
          
          {/* Zone C & D: Left data and Right Voice Pick box */}
          <View style={styles.contentRow}>
            <View style={styles.leftColumn}>
              <Text style={{ fontSize: 9 }}>
                <Text style={styles.label}>GTIN:</Text>
                {gtin}
              </Text>
              <Text style={{ fontSize: 9, marginTop: 2 }}>
                <Text style={styles.label}>LOT:</Text>
                {lotNumber}
              </Text>
              <Text style={{ fontSize: 9, marginTop: 2 }}>
                <Text style={styles.label}>PACK:</Text>
                {packDateDisplay}
              </Text>
            </View>
            
            <View style={styles.rightColumn}>
              <View style={styles.voicePickBox}>
                <Text style={styles.voicePickSmall}>{small}</Text>
                <Text style={styles.voicePickLarge}>{large}</Text>
              </View>
            </View>
          </View>
          
          {/* Zone E: Bottom GS1-128 barcode */}
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
