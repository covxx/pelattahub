/**
 * Browser-native print utility for ZPL labels
 * Prints raw ZPL code as plain text to a Generic/Text printer driver
 */

/**
 * Print ZPL string via browser's native print dialog
 * Uses a hidden iframe for seamless printing experience
 * Falls back to window.open if iframe printing is blocked
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

  try {
    // Create a hidden iframe for seamless printing
    const iframe = document.createElement("iframe")
    
    // Style the iframe to be hidden
    iframe.style.visibility = "hidden"
    iframe.style.position = "absolute"
    iframe.style.top = "0"
    iframe.style.left = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "none"
    
    // Append to document body
    document.body.appendChild(iframe)
    
    // Get the iframe's document
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    
    if (!iframeDoc) {
      // If we can't access iframe document, fall back to window.open
      document.body.removeChild(iframe)
      return printZplViaBrowserFallback(zplString, { autoClose, windowTitle })
    }
    
    // Write the ZPL content to the iframe
    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${escapeHtml(windowTitle)}</title>
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
    iframeDoc.close()
    
    // Wait for iframe content to load, then trigger print
    const printIframe = () => {
      try {
        const iframeWindow = iframe.contentWindow
        
        if (!iframeWindow) {
          throw new Error("Cannot access iframe window")
        }
        
        // Small delay to ensure content is rendered
        setTimeout(() => {
          try {
            // Trigger print dialog
            iframeWindow.print()
            
            // Clean up iframe after printing
            const cleanup = () => {
              // Remove iframe from DOM
              if (iframe.parentNode) {
                document.body.removeChild(iframe)
              }
            }
            
            // Try to detect when printing is done
            if (iframeWindow.matchMedia) {
              // Listen for print media query
              const mediaQuery = iframeWindow.matchMedia("print")
              
              // Cleanup after print dialog closes
              const handlePrintChange = (mql: MediaQueryList | MediaQueryListEvent) => {
                if (!mql.matches) {
                  // Print dialog closed
                  setTimeout(cleanup, 100)
                }
              }
              
              // Modern browsers
              if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener("change", handlePrintChange)
              } else {
                // Legacy browsers
                mediaQuery.addListener(handlePrintChange)
              }
            }
            
            // Fallback cleanup after a delay
            setTimeout(cleanup, 2000)
            
            // Also try onafterprint event
            if (iframeWindow.onafterprint !== undefined) {
              iframeWindow.onafterprint = () => {
                setTimeout(cleanup, 100)
              }
            }
          } catch (printError) {
            // If printing fails, remove iframe and fall back
            console.warn("Iframe printing failed, falling back to window.open:", printError)
            document.body.removeChild(iframe)
            printZplViaBrowserFallback(zplString, { autoClose, windowTitle })
          }
        }, 100)
      } catch (error) {
        // If we can't access iframe window, fall back
        console.warn("Cannot access iframe window, falling back to window.open:", error)
        if (iframe.parentNode) {
          document.body.removeChild(iframe)
        }
        printZplViaBrowserFallback(zplString, { autoClose, windowTitle })
      }
    }
    
    // Wait for iframe to load
    if (iframe.contentWindow) {
      if (iframe.contentWindow.document.readyState === "complete") {
        printIframe()
      } else {
        iframe.onload = printIframe
        // Fallback timeout
        setTimeout(printIframe, 500)
      }
    } else {
      // Iframe not accessible, fall back
      document.body.removeChild(iframe)
      printZplViaBrowserFallback(zplString, { autoClose, windowTitle })
    }
  } catch (error) {
    // If iframe approach fails completely, fall back to window.open
    console.warn("Iframe approach failed, falling back to window.open:", error)
    printZplViaBrowserFallback(zplString, { autoClose, windowTitle })
  }
}

/**
 * Fallback method using window.open
 * Used when iframe printing is blocked or unavailable
 */
function printZplViaBrowserFallback(
  zplString: string,
  options?: {
    autoClose?: boolean
    windowTitle?: string
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
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(windowTitle)}</title>
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
        // Close window after printing
        const handleAfterPrint = () => {
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close()
            }
          }, 100)
        }

        // Close on print completion
        printWindow.onafterprint = handleAfterPrint

        // Fallback: Close after timeout if still open
        setTimeout(() => {
          if (!printWindow.closed) {
            printWindow.close()
          }
        }, 2000)
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

