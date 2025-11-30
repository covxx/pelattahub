import { NextRequest, NextResponse } from "next/server"
import React from "react"
import { auth } from "@/lib/auth"
import { getReceivingEvent } from "@/app/actions/receiving"
import { getCompanySettings } from "@/app/actions/settings"
import { ReceivingReceiptPDF } from "@/components/documents/ReceivingReceiptPDF"
import { renderToBuffer } from "@react-pdf/renderer"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get("eventId")

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 })
    }

    // Fetch receiving event and company settings
    const [event, companySettings] = await Promise.all([
      getReceivingEvent(eventId),
      getCompanySettings(),
    ])

    if (!event) {
      return NextResponse.json({ error: "Receiving event not found" }, { status: 404 })
    }

    // Serialize data for PDF
    const serializedEvent = {
      ...event,
      received_date:
        event.received_date instanceof Date
          ? event.received_date.toISOString()
          : typeof event.received_date === "string"
          ? event.received_date
          : new Date(event.received_date).toISOString(),
      lots: (event.lots || []).map((lot: any) => ({
        ...lot,
        product: {
          ...lot.product,
          standard_case_weight: lot.product?.standard_case_weight ?? null,
          unit_type: lot.product?.unit_type || "CASE",
          name: lot.product?.name || "Unknown",
          sku: lot.product?.sku || "N/A",
          variety: lot.product?.variety || null,
        },
      })),
    }

    // Generate PDF buffer using React.createElement to avoid JSX in API route
    const pdfElement = React.createElement(ReceivingReceiptPDF, {
      receivingEvent: serializedEvent,
      companySettings: companySettings,
    })
    
    const pdfBuffer = await renderToBuffer(pdfElement as any)

    // Convert buffer to Uint8Array for NextResponse
    const pdfArray = new Uint8Array(pdfBuffer)
    
    // Return PDF as response
    return new NextResponse(pdfArray, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Receiving_Receipt_${eventId.slice(0, 8).toUpperCase()}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate PDF" },
      { status: 500 }
    )
  }
}

