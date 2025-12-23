import React from 'react'
import { Document, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { BaseLabel } from '../BaseLabel'
import { format } from 'date-fns'
import { generateBarcodeDataUrl, formatGS1Barcode, padGTIN } from '@/lib/barcode-generator'
import { getVoicePickCode, formatDateForVoicePick, formatVoicePick } from '@/lib/voice-pick'

/**
 * Case Label PDF Template
 * 
 * 4x2 inch label with horizontal layout
 * Top Section: Two columns (left: info, right: voice pick)
 * Bottom Section: Full-width centered barcode
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
    sku?: string
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
    padding: 4,
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  topSection: {
    flexDirection: 'row',
    flex: 1,
  },
  leftColumn: {
    width: '60%',
    paddingRight: 6,
    justifyContent: 'flex-start',
  },
  rightColumn: {
    width: '40%',
    paddingLeft: 4,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  companyName: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
    fontFamily: 'Helvetica-Bold',
  },
  companyAddress: {
    fontSize: 7,
    color: '#000',
    marginBottom: 4,
    fontFamily: 'Helvetica',
  },
  itemDescription: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 3,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },
  skuText: {
    fontSize: 9,
    color: '#000',
    marginBottom: 2,
    fontFamily: 'Helvetica',
  },
  lotText: {
    fontSize: 9,
    color: '#000',
    fontFamily: 'Helvetica',
  },
  label: {
    fontWeight: 'bold',
    marginRight: 3,
  },
  voicePickContainer: {
    backgroundColor: '#000',
    padding: 4,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    minHeight: 50,
  },
  voicePickSmall: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  voicePickLarge: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1,
  },
  barcodeWrapper: {
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  barcodeImage: {
    width: '100%',
    maxWidth: 250,
    height: 40,
    marginBottom: 2,
  },
  barcodeText: {
    fontSize: 6,
    textAlign: 'center',
    color: '#000',
    fontFamily: 'Helvetica',
  },
})

export function CaseLabelPdf({ lot, product, companySettings }: CaseLabelData) {
  const companyName = companySettings?.name || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Fresh Produce Co.'
  const companyAddress = companySettings?.address || process.env.NEXT_PUBLIC_COMPANY_ADDRESS || ''
  
  const lotNumber = lot.lot_number
  const itemDescription = product.name.toUpperCase()
  const sku = product.sku || product.gtin || ''
  const gtin = padGTIN(product.gtin)
  const receivedDate = new Date(lot.received_date)

  // Calculate Voice Pick check digit
  const voicePickDateStr = formatDateForVoicePick(receivedDate)
  const voicePickCode = getVoicePickCode(gtin, lotNumber, voicePickDateStr)
  const { small, large } = formatVoicePick(voicePickCode)

  // Construct GS1-128 barcode data
  const barcodeData = formatGS1Barcode(gtin, lotNumber)
  const barcodeHRI = `(01) ${gtin} (10) ${lotNumber}`

  // Generate barcode image
  const barcodeImageUrl = generateBarcodeDataUrl(barcodeData, 'CODE128')

  return (
    <Document>
      <BaseLabel width={4} height={2}>
        <View style={styles.container}>
          {/* Top Section: Two columns */}
          <View style={styles.topSection}>
            {/* Left Column: Human-readable information */}
            <View style={styles.leftColumn}>
              <Text style={styles.companyName}>{companyName}</Text>
              {companyAddress && (
                <Text style={styles.companyAddress}>{companyAddress}</Text>
              )}
              <Text style={styles.itemDescription}>{itemDescription}</Text>
              {sku && (
                <Text style={styles.skuText}>
                  <Text style={styles.label}>SKU:</Text>
                  {sku}
                </Text>
              )}
              <Text style={styles.lotText}>
                <Text style={styles.label}>LOT:</Text>
                {lotNumber}
              </Text>
            </View>

            {/* Right Column: Voice Pick box */}
            <View style={styles.rightColumn}>
              {/* Voice Pick Code Box - Inverted (black bg, white text) */}
              <View style={styles.voicePickContainer}>
                <Text style={styles.voicePickSmall}>{small}</Text>
                <Text style={styles.voicePickLarge}>{large}</Text>
              </View>
            </View>
          </View>

          {/* Bottom Section: Full-width centered barcode */}
          <View style={styles.barcodeWrapper}>
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
