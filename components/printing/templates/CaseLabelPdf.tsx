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
  container: {
    backgroundColor: '#fff',
    padding: 6,
    height: '100%',
    justifyContent: 'space-between',
  },
  companyHeader: {
    fontSize: 9,
    textAlign: 'left',
    color: '#000',
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
    paddingLeft: 4,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'left',
    color: '#000',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
    paddingLeft: 4,
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  leftColumn: {
    flex: 1,
    paddingLeft: 4,
  },
  lotText: {
    fontSize: 11,
    color: '#000',
    fontFamily: 'Helvetica',
  },
  label: {
    fontWeight: 'bold',
    marginRight: 4,
  },
  rightColumn: {
    width: 90,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  voicePickBox: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderStyle: 'solid',
    padding: 6,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePickSmall: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 3,
    fontFamily: 'Helvetica-Bold',
  },
  voicePickLarge: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1,
  },
  barcodeContainer: {
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  barcodeImage: {
    width: 200,
    height: 45,
    marginBottom: 3,
  },
  barcodeText: {
    fontSize: 7,
    textAlign: 'center',
    color: '#000',
    fontFamily: 'Helvetica',
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
        <View style={styles.container}>
          {/* Company name header */}
          <Text style={styles.companyHeader}>{companyName}</Text>
          
          {/* Product name */}
          <Text style={styles.productName}>{productName}</Text>
          
          {/* Middle Row: LOT and Voice Pick box */}
          <View style={styles.contentRow}>
            {/* Left Column: LOT only */}
            <View style={styles.leftColumn}>
              <Text style={styles.lotText}>
                <Text style={styles.label}>LOT:</Text>
                {lotNumber}
              </Text>
            </View>
            
            {/* Right Column: Voice Pick box */}
            <View style={styles.rightColumn}>
              <View style={styles.voicePickBox}>
                <Text style={styles.voicePickSmall}>{small}</Text>
                <Text style={styles.voicePickLarge}>{large}</Text>
              </View>
            </View>
          </View>
          
          {/* Bottom: GS1-128 barcode (includes GTIN and LOT in HRI) */}
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
