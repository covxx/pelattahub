// Web Serial API Type Definitions
// These types are for the Web Serial API used in Chromium browsers

interface SerialOptions {
  baudRate: number
  dataBits?: 7 | 8
  stopBits?: 1 | 2
  parity?: "none" | "even" | "odd"
  bufferSize?: number
  flowControl?: "none" | "hardware"
}

interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
}

interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  getInfo(): SerialPortInfo
}

interface SerialPortRequestOptions {
  filters?: Array<{
    usbVendorId?: number
    usbProductId?: number
  }>
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
  addEventListener(
    type: "connect" | "disconnect",
    listener: (event: Event) => void
  ): void
  removeEventListener(
    type: "connect" | "disconnect",
    listener: (event: Event) => void
  ): void
}

interface Navigator {
  serial?: Serial
}

