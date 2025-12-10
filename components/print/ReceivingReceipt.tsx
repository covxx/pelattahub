"use client"

import { format } from "date-fns"

interface ReceivingReceiptProps {
  receivingEvent: {
    id: string
    receipt_number?: number
    received_date: Date | string
    vendor: {
      name: string
      code: string
    }
    user?: {
      name: string | null
    }
    lots: Array<{
      id: string
      lot_number: string
      original_quantity: number
      product: {
        sku: string
        name: string
        unit_type: string
        variety?: string | null
      }
    }>
  }
}

export function ReceivingReceipt({ receivingEvent }: ReceivingReceiptProps) {
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Fresh Produce Co."
  const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "123 Farm Road, CA 90210"
  const companyPhone = process.env.NEXT_PUBLIC_COMPANY_PHONE || "(555) 123-4567"

  const receivedDate = new Date(receivingEvent.received_date)
  const formattedDate = format(receivedDate, "MM/dd/yyyy")
  const receiptNumber = receivingEvent.receipt_number?.toString() || receivingEvent.id.slice(0, 8).toUpperCase()

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white !important;
          }
          
          /* Hide everything except the receipt */
          body > *:not(.print-receipt-root) {
            display: none !important;
          }
          
          .print-receipt-root {
            display: block !important;
            visibility: visible !important;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            background: white;
            padding: 0.5in;
          }
          
          .receipt-container {
            font-family: 'Courier New', Courier, monospace;
            color: #000;
            background: white;
            max-width: 8.5in;
            margin: 0 auto;
          }
          
          .receipt-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          
          .company-info {
            text-align: left;
          }
          
          .company-name {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .company-details {
            font-size: 10pt;
            line-height: 1.4;
          }
          
          .receipt-info {
            text-align: right;
          }
          
          .receipt-title {
            font-size: 24pt;
            font-weight: bold;
            margin-bottom: 10px;
          }
          
          .receipt-meta {
            font-size: 10pt;
            line-height: 1.6;
          }
          
          .vendor-block {
            margin-bottom: 30px;
            padding: 15px;
            border: 2px solid #000;
            background: #f5f5f5;
          }
          
          .vendor-label {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .vendor-name {
            font-size: 14pt;
            font-weight: bold;
          }
          
          .vendor-code {
            font-size: 10pt;
            color: #333;
          }
          
          .receipt-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 10pt;
          }
          
          .receipt-table thead {
            background: #000;
            color: white;
          }
          
          .receipt-table th {
            padding: 12px 8px;
            text-align: left;
            font-weight: bold;
            border: 1px solid #000;
          }
          
          .receipt-table td {
            padding: 10px 8px;
            border: 1px solid #000;
          }
          
          .receipt-table tbody tr:nth-child(even) {
            background: #f9f9f9;
          }
          
          .receipt-footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #000;
          }
          
          .footer-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
          }
          
          .footer-label {
            font-size: 11pt;
            font-weight: bold;
          }
          
          .footer-value {
            font-size: 11pt;
          }
          
          .signature-line {
            border-bottom: 2px solid #000;
            width: 300px;
            display: inline-block;
            margin-left: 10px;
          }
          
          /* Hide screen-only elements */
          .no-print {
            display: none !important;
          }
        }
        
        /* Screen styles */
        @media screen {
          .print-receipt-root {
            background: white;
            max-width: 8.5in;
            margin: 20px auto;
            padding: 0.5in;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          
          .receipt-container {
            font-family: 'Courier New', Courier, monospace;
            color: #000;
          }
          
          .receipt-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          
          .company-info {
            text-align: left;
          }
          
          .company-name {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .company-details {
            font-size: 10pt;
            line-height: 1.4;
          }
          
          .receipt-info {
            text-align: right;
          }
          
          .receipt-title {
            font-size: 24pt;
            font-weight: bold;
            margin-bottom: 10px;
          }
          
          .receipt-meta {
            font-size: 10pt;
            line-height: 1.6;
          }
          
          .vendor-block {
            margin-bottom: 30px;
            padding: 15px;
            border: 2px solid #000;
            background: #f5f5f5;
          }
          
          .vendor-label {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .vendor-name {
            font-size: 14pt;
            font-weight: bold;
          }
          
          .vendor-code {
            font-size: 10pt;
            color: #333;
          }
          
          .receipt-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 10pt;
          }
          
          .receipt-table thead {
            background: #000;
            color: white;
          }
          
          .receipt-table th {
            padding: 12px 8px;
            text-align: left;
            font-weight: bold;
            border: 1px solid #000;
          }
          
          .receipt-table td {
            padding: 10px 8px;
            border: 1px solid #000;
          }
          
          .receipt-table tbody tr:nth-child(even) {
            background: #f9f9f9;
          }
          
          .receipt-footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #000;
          }
          
          .footer-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
          }
          
          .footer-label {
            font-size: 11pt;
            font-weight: bold;
          }
          
          .footer-value {
            font-size: 11pt;
          }
          
          .signature-line {
            border-bottom: 2px solid #000;
            width: 300px;
            display: inline-block;
            margin-left: 10px;
          }
        }
      `}</style>

      <div className="print-receipt-root">
        <div className="receipt-container">
          {/* Header */}
          <div className="receipt-header">
            {/* Left: Company Info */}
            <div className="company-info">
              <div className="company-name">{companyName}</div>
              <div className="company-details">
                {companyAddress}
                <br />
                {companyPhone}
              </div>
            </div>

            {/* Right: Receipt Info */}
            <div className="receipt-info">
              <div className="receipt-title">RECEIVING RECEIPT</div>
              <div className="receipt-meta">
                <div>
                  <strong>Receipt #:</strong> {receiptNumber}
                </div>
                <div>
                  <strong>Date:</strong> {formattedDate}
                </div>
              </div>
            </div>
          </div>

          {/* Vendor Block */}
          <div className="vendor-block">
            <div className="vendor-label">RECEIVED FROM:</div>
            <div className="vendor-name">{receivingEvent.vendor.name}</div>
            <div className="vendor-code">
              Vendor Code: {receivingEvent.vendor.code}
            </div>
          </div>

          {/* Items Table */}
          <table className="receipt-table">
            <thead>
              <tr>
                <th style={{ width: "15%" }}>SKU</th>
                <th style={{ width: "35%" }}>DESCRIPTION</th>
                <th style={{ width: "25%" }}>LOT NUMBER</th>
                <th style={{ width: "15%", textAlign: "right" }}>QTY RECEIVED</th>
                <th style={{ width: "10%" }}>UNIT</th>
              </tr>
            </thead>
            <tbody>
              {receivingEvent.lots.map((lot) => (
                <tr key={lot.id}>
                  <td style={{ fontWeight: "bold" }}>{lot.product.sku}</td>
                  <td>
                    {lot.product.name}
                    {lot.product.variety && (
                      <span style={{ fontStyle: "italic" }}>
                        {" "}
                        - {lot.product.variety}
                      </span>
                    )}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "9pt" }}>
                    {lot.lot_number}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>
                    {lot.original_quantity}
                  </td>
                  <td>{lot.product.unit_type}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ fontWeight: "bold", textAlign: "right" }}>
                  TOTAL ITEMS:
                </td>
                <td style={{ fontWeight: "bold", textAlign: "right" }}>
                  {receivingEvent.lots.length}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          {/* Footer */}
          <div className="receipt-footer">
            <div className="footer-row">
              <div>
                <span className="footer-label">Received By:</span>
                <span className="footer-value">
                  {" "}
                  {receivingEvent.user?.name || "N/A"}
                </span>
              </div>
              <div>
                <span className="footer-label">Date:</span>
                <span className="footer-value"> {formattedDate}</span>
              </div>
            </div>

            <div>
              <span className="footer-label">Signature:</span>
              <span className="signature-line">&nbsp;</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

