/**
 * Browser-native print utility for ZPL labels
 * Prints raw ZPL code as plain text to a Generic/Text printer driver
 */

/**
 * Print ZPL string via browser's native print dialog
 * Opens a new window with the ZPL content and triggers print dialog
 * 
 * @param zplString - The raw ZPL command string to print
 * @param options - Optional configuration
 */
export function printZplViaBrowser(
  zplString: string,
  options?: {
    autoClose?: boolean // Auto-close window after printing (default: true)
    windowTitle?: string // Title for the print window (default: "Print Label")
  }
) {
  const { autoClose = true, windowTitle = "Print Label" } = options || {}

  // Open a new popup window
  const printWindow = window.open("", "_blank", "width=800,height=600")

  if (!printWindow) {
    throw new Error(
      "Failed to open print window. Please allow popups for this site."
    )
  }

  // Write the ZPL content to the window
  // Using <pre> tag to preserve whitespace and formatting
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${windowTitle}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            padding: 10px;
            background: white;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.2;
          }
          @media print {
            body {
              padding: 0;
              margin: 0;
            }
            pre {
              margin: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <pre>${escapeHtml(zplString)}</pre>
      </body>
    </html>
  `)

  printWindow.document.close()

  // Wait for content to load, then trigger print
  printWindow.onload = () => {
    // Small delay to ensure content is rendered
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()

      // Setup event listeners for cleanup
      if (autoClose) {
        // Close window after printing or if user cancels
        const handleAfterPrint = () => {
          printWindow.close()
        }

        // Close on print completion
        printWindow.onafterprint = handleAfterPrint

        // Fallback: Close if window loses focus (user canceled print)
        printWindow.onblur = () => {
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close()
            }
          }, 500)
        }
      }
    }, 250)
  }
}

/**
 * Batch print multiple ZPL labels
 * Opens one window per label with a delay between each
 * 
 * @param zplStrings - Array of ZPL command strings
 * @param delayMs - Delay between opening each print window (default: 500ms)
 */
export async function printMultipleZplLabels(
  zplStrings: string[],
  delayMs: number = 500
) {
  for (const zplString of zplStrings) {
    printZplViaBrowser(zplString, { autoClose: true })
    
    // Wait before opening next window to avoid browser popup blocking
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

/**
 * Download ZPL as a text file
 * Useful for sending to a printer queue or saving for later
 * 
 * @param zplString - The ZPL command string
 * @param filename - Name for the downloaded file (default: "label.zpl")
 */
export function downloadZplAsFile(
  zplString: string,
  filename: string = "label.zpl"
) {
  const blob = new Blob([zplString], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  
  link.href = url
  link.download = filename
  link.style.display = "none"
  
  document.body.appendChild(link)
  link.click()
  
  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Copy ZPL to clipboard
 * Useful for pasting into printer management software
 * 
 * @param zplString - The ZPL command string
 */
export async function copyZplToClipboard(zplString: string) {
  try {
    await navigator.clipboard.writeText(zplString)
    return true
  } catch (error) {
    console.error("Failed to copy to clipboard:", error)
    return false
  }
}

/**
 * Escape HTML special characters to prevent XSS
 * @param text - Text to escape
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

