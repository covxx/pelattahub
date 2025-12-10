# Data Import Usage Guide

## Overview

The import system provides two main functions:
1. `validateImportData` - Validates and stages import data
2. `commitImport` - Commits validated data to the database

## Installation

First, install the required dependency:

```bash
npm install xlsx
```

## Usage Flow

### 1. Parse Excel/CSV File (Client-Side)

```typescript
import * as XLSX from 'xlsx'
import { validateImportData, commitImport } from '@/app/actions/import'

// Example: Parse Excel file
function parseExcelFile(file: File): Promise<Array<Record<string, any>>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet)
        resolve(jsonData)
      } catch (error) {
        reject(error)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}
```

### 2. Validate Import Data

```typescript
// Example: Validate product import
const file = // ... file from input
const jsonData = await parseExcelFile(file)

const validation = await validateImportData('PRODUCT', jsonData)

// validation contains:
// - validRecords: Records ready to import
// - conflicts: Records that exist (need user decision)
// - errors: Records with validation errors
// - summary: Counts of each category
```

### 3. Handle Conflicts

```typescript
// User reviews conflicts and decides
const conflictResolutions = new Map<number, 'OVERWRITE' | 'SKIP'>()

// For each conflict, user chooses:
conflictResolutions.set(conflictRow, 'OVERWRITE') // or 'SKIP'
```

### 4. Commit Import

```typescript
// Prepare records with conflict resolutions
const recordsToCommit = [
  ...validation.validRecords.map(r => ({ ...r })),
  ...validation.conflicts.map(c => ({
    row: c.row,
    data: c.data,
    existingId: c.existingId,
    conflictResolution: conflictResolutions.get(c.row) || 'SKIP'
  }))
]

const result = await commitImport('PRODUCT', recordsToCommit)

// result contains:
// - success: boolean
// - created: number of new records
// - updated: number of updated records
// - skipped: number of skipped records
```

## Expected File Formats

### PRODUCT Import

Required columns:
- `name` (string) - Product name
- `sku` (string) - Unique SKU
- `gtin` (string) - 14-digit GTIN
- `default_origin_country` (string) - Country code

Optional columns:
- `variety` (string)
- `description` (string)
- `unit_type` (CASE | LBS | EACH) - Default: CASE
- `standard_case_weight` (number)
- `target_temp_f` (integer)
- `image_url` (string)

### CUSTOMER Import

Required columns:
- `name` (string) - Customer name
- `code` (string) - Unique customer code

Optional columns:
- `address` (string)
- `contact_email` (string) - Must be valid email if provided
- `active` (boolean) - Default: true

### VENDOR Import

Required columns:
- `name` (string) - Vendor name
- `code` (string) - Unique vendor code

Optional columns:
- `active` (boolean) - Default: true

## Validation Rules

### PRODUCT
- SKU must be unique
- GTIN must be unique and exactly 14 digits
- Name, SKU, GTIN, and default_origin_country are required
- Unit type must be CASE, LBS, or EACH
- Standard case weight must be positive if provided
- Target temp must be valid integer if provided

### CUSTOMER
- Code must be unique
- Name and code are required
- Contact email must be valid format if provided

### VENDOR
- Code must be unique
- Name and code are required

## Error Handling

All validation errors are returned in the `errors` array with:
- `row`: Row number (1-indexed)
- `data`: The original record data
- `errors`: Array of error messages

## Audit Logging

All imports are logged to the audit trail with:
- Action: `BULK_IMPORT`
- Entity Type: PRODUCT, CUSTOMER, or VENDOR
- Details: Counts of created, updated, and skipped records

## Example Component

```typescript
'use client'

import { useState } from 'react'
import { validateImportData, commitImport } from '@/app/actions/import'
import * as XLSX from 'xlsx'

export function ImportDialog({ type, onClose }: { type: 'PRODUCT' | 'CUSTOMER' | 'VENDOR', onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [validation, setValidation] = useState<any>(null)
  const [conflictResolutions, setConflictResolutions] = useState<Map<number, 'OVERWRITE' | 'SKIP'>>(new Map())
  const [isImporting, setIsImporting] = useState(false)

  const handleValidate = async () => {
    if (!file) return

    const jsonData = await parseExcelFile(file)
    const result = await validateImportData(type, jsonData)
    setValidation(result)
  }

  const handleImport = async () => {
    if (!validation) return

    setIsImporting(true)
    const recordsToCommit = [
      ...validation.validRecords,
      ...validation.conflicts.map((c: any) => ({
        ...c,
        conflictResolution: conflictResolutions.get(c.row) || 'SKIP'
      }))
    ]

    const result = await commitImport(type, recordsToCommit)
    setIsImporting(false)

    if (result.success) {
      alert(`Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`)
      onClose()
    } else {
      alert(`Import failed: ${result.error}`)
    }
  }

  return (
    // ... UI implementation
  )
}
```

