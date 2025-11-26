"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { generateProduceLabel } from "@/lib/zpl-generator"
import type { LotData } from "@/types/lot"

export default function TestZPLPage() {
  const [zplOutput, setZplOutput] = useState("")
  const [lotNumber, setLotNumber] = useState("LOT-12345")
  const [productName, setProductName] = useState("Gala Apples")
  const [gtin, setGtin] = useState("0123456789012")

  const testLotData: LotData = {
    lot_number: lotNumber,
    product: {
      name: productName,
      sku: "APP-GAL-40",
      variety: "Royal Gala",
      gtin: gtin,
    },
    quantity_received: 100,
    quantity_current: 100,
    received_date: new Date(),
    expiry_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    origin_country: "USA",
    grower_id: "GROWER-123",
    status: "RECEIVED",
  }

  const handleGenerate = () => {
    const zpl = generateProduceLabel(testLotData)
    setZplOutput(zpl)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(zplOutput)
    alert("ZPL copied to clipboard!")
  }

  const handleDownload = () => {
    const blob = new Blob([zplOutput], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `label-${lotNumber}.zpl`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePreview = async () => {
    try {
      const response = await fetch(
        "https://api.labelary.com/v1/printers/8dpmm/labels/4x2/0/",
        {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "Accept": "application/pdf",
          },
          body: zplOutput,
        }
      )

      if (!response.ok) {
        throw new Error("Failed to generate preview")
      }

      const pdfBlob = await response.blob()
      const pdfUrl = URL.createObjectURL(pdfBlob)
      window.open(pdfUrl, "_blank")
    } catch (error) {
      alert(`Preview failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">ZPL Generator Test</h1>
      <p className="text-muted-foreground mb-8">
        Test the GS1-128 barcode label generator for produce lots
      </p>

      <div className="grid grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Label Data</h2>
          
          <div>
            <Label>Lot Number</Label>
            <Input
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder="LOT-12345"
            />
          </div>

          <div>
            <Label>Product Name</Label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Gala Apples"
            />
          </div>

          <div>
            <Label>GTIN (will be padded to 14 digits)</Label>
            <Input
              value={gtin}
              onChange={(e) => setGtin(e.target.value)}
              placeholder="0123456789012"
            />
          </div>

          <div className="space-y-2 pt-4">
            <Button onClick={handleGenerate} className="w-full">
              Generate ZPL
            </Button>
            {zplOutput && (
              <>
                <Button onClick={handleCopy} variant="outline" className="w-full">
                  Copy to Clipboard
                </Button>
                <Button onClick={handleDownload} variant="outline" className="w-full">
                  Download .zpl File
                </Button>
                <Button onClick={handlePreview} variant="secondary" className="w-full">
                  Preview (via Labelary)
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Output Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">ZPL Output</h2>
          {zplOutput ? (
            <div className="relative">
              <pre className="p-4 bg-gray-100 dark:bg-gray-900 rounded overflow-auto max-h-[600px] text-xs font-mono">
                {zplOutput}
              </pre>
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded">
                <h3 className="font-semibold mb-2">Barcode Data Breakdown:</h3>
                <ul className="text-sm space-y-1 font-mono">
                  <li><strong>&gt;;</strong> = Start Code C</li>
                  <li><strong>&gt;8</strong> = FNC1 (GS1-128 indicator)</li>
                  <li><strong>01</strong> = GTIN Application Identifier</li>
                  <li><strong>{gtin.padStart(14, "0")}</strong> = 14-digit GTIN</li>
                  <li><strong>17</strong> = Expiry Date Application Identifier</li>
                  <li><strong>YYMMDD</strong> = Expiry date format</li>
                  <li><strong>&gt;6</strong> = Switch to Subset B</li>
                  <li><strong>10</strong> = Lot Number Application Identifier</li>
                  <li><strong>{lotNumber}</strong> = Lot number</li>
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Click "Generate ZPL" to see the output
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-950 rounded">
        <h3 className="font-semibold mb-2">Label Specifications:</h3>
        <ul className="text-sm space-y-1">
          <li>• <strong>Size:</strong> 4 inches × 2 inches</li>
          <li>• <strong>DPI:</strong> 203 DPI (8 dots/mm)</li>
          <li>• <strong>Dimensions:</strong> 812 dots × 406 dots</li>
          <li>• <strong>Barcode:</strong> GS1-128 (Code 128 variant)</li>
          <li>• <strong>Expiry Calculation:</strong> Received Date + 10 days</li>
          <li>• <strong>Company Info:</strong> From env vars or defaults</li>
        </ul>
      </div>
    </div>
  )
}

