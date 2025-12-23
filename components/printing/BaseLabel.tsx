import React from 'react'
import { Page, View, StyleSheet } from '@react-pdf/renderer'

/**
 * BaseLabel Component
 * 
 * Provides a base wrapper for PDF labels with dynamic page sizing.
 * React-PDF uses points (1 inch = 72 points).
 * 
 * Supported sizes:
 * - 4x6 inches = 288 x 432 points (Pallet Labels)
 * - 4x2 inches = 288 x 144 points (Case Labels)
 * 
 * @param width - Label width in inches (e.g., 4)
 * @param height - Label height in inches (e.g., 6 or 2)
 * @param children - React elements to render inside the label
 */
interface BaseLabelProps {
  width: number // Width in inches
  height: number // Height in inches
  children: React.ReactNode
}

/**
 * Converts inches to points for React-PDF
 * 1 inch = 72 points
 */
function inchesToPoints(inches: number): number {
  return inches * 72
}

/**
 * Creates a page size array in points [width, height]
 */
function getPageSize(widthInches: number, heightInches: number): [number, number] {
  return [inchesToPoints(widthInches), inchesToPoints(heightInches)]
}

const styles = StyleSheet.create({
  page: {
    padding: 0,
    margin: 0,
  },
  container: {
    width: '100%',
    height: '100%',
    padding: 0,
    margin: 0,
  },
})

export function BaseLabel({ width, height, children }: BaseLabelProps) {
  const pageSize = getPageSize(width, height)

  return (
    <Page size={pageSize} style={styles.page}>
      <View style={styles.container}>
        {children}
      </View>
    </Page>
  )
}
