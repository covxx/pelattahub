"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react"

interface ZebraPrinterContextType {
  isConnected: boolean
  isSupported: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  print: (zplString: string) => Promise<void>
  error: string | null
}

const ZebraPrinterContext = createContext<ZebraPrinterContextType | undefined>(undefined)

interface ZebraPrinterProviderProps {
  children: ReactNode
}

export function ZebraPrinterProvider({ children }: ZebraPrinterProviderProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [writer, setWriter] = useState<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const [port, setPort] = useState<SerialPort | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check if Web Serial API is supported
  const isSupported = typeof window !== "undefined" && "serial" in navigator

  const connect = useCallback(async () => {
    try {
      setError(null)

      if (!isSupported) {
        throw new Error(
          "Web Serial API is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser with HTTPS."
        )
      }

      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        throw new Error("Web Serial API requires a secure context (HTTPS or localhost)")
      }

      if (!navigator.serial) {
        throw new Error("Serial API not available")
      }

      // Request port from user
      const selectedPort = await navigator.serial.requestPort()

      // Open the port with Zebra printer settings
      await selectedPort.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      })

      // Get the writable stream
      if (!selectedPort.writable) {
        throw new Error("Port does not have a writable stream")
      }

      const portWriter = selectedPort.writable.getWriter()
      setWriter(portWriter)
      setPort(selectedPort)
      setIsConnected(true)
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to connect to printer. Please ensure the device is connected and try again."
      setError(errorMessage)
      setIsConnected(false)
      setWriter(null)
      setPort(null)
      throw err
    }
  }, [isSupported])

  const disconnect = useCallback(async () => {
    try {
      if (writer) {
        await writer.close()
        setWriter(null)
      }
      if (port) {
        await port.close()
        setPort(null)
      }
      setIsConnected(false)
      setError(null)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to disconnect from printer"
      setError(errorMessage)
      // Force reset state even if close fails
      setIsConnected(false)
      setWriter(null)
      setPort(null)
    }
  }, [writer, port])

  const print = useCallback(
    async (zplString: string) => {
      try {
        setError(null)

        if (!isConnected || !writer) {
          throw new Error("Printer is not connected. Please connect first.")
        }

        // Convert ZPL string to Uint8Array
        const encoder = new TextEncoder()
        const data = encoder.encode(zplString)

        // Write to the printer
        await writer.write(data)

        // Ensure data is flushed
        await writer.ready
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to print. The printer may have been disconnected."
        setError(errorMessage)

        // If write fails, likely the port was disconnected
        if (
          err instanceof Error &&
          (err.message.includes("disconnected") ||
            err.message.includes("closed") ||
            err.message.includes("busy"))
        ) {
          // Auto-disconnect on error
          await disconnect()
        }

        throw err
      }
    },
    [isConnected, writer, disconnect]
  )

  return (
    <ZebraPrinterContext.Provider
      value={{
        isConnected,
        isSupported,
        connect,
        disconnect,
        print,
        error,
      }}
    >
      {children}
    </ZebraPrinterContext.Provider>
  )
}

export function useZebraPrinter() {
  const context = useContext(ZebraPrinterContext)
  if (context === undefined) {
    throw new Error("useZebraPrinter must be used within a ZebraPrinterProvider")
  }
  return context
}

