import type { SmsMessagePreview } from './SmsResultsService'

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  getInfo?: () => { usbVendorId?: number; usbProductId?: number }
}

type NavigatorWithSerial = Navigator & {
  serial?: {
    requestPort(): Promise<SerialPortLike>
    getPorts(): Promise<SerialPortLike[]>
  }
}

export interface DeviceInfo {
  name: string
  port: string
  status: 'connected' | 'disconnected' | 'busy'
  type: 'usb' | 'wifi' | 'android'
}

const CTRL_Z = String.fromCharCode(26)

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Validate phone number (supports Tanzania format: 10 digits starting with 0)
function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  const cleaned = phone.replace(/\D/g, '') // Remove non-digits
  
  // Check if empty
  if (!cleaned) {
    return { valid: false, error: 'Phone number is required' }
  }
  
  // Check length (should be 10 digits for Tanzania format, or 12 with country code)
  if (cleaned.length !== 10 && cleaned.length !== 12) {
    return { valid: false, error: 'Phone number must be 10 or 12 digits' }
  }
  
  // Check if starts with valid prefix (0 for local, or country code)
  if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    return { valid: false, error: 'Phone number must start with 0' }
  }
  
  if (cleaned.length === 12 && !cleaned.startsWith('255')) {
    return { valid: false, error: 'International format must start with 255' }
  }
  
  return { valid: true }
}

export class SmsModemSender {
  private static port: SerialPortLike | null = null
  private static reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private static writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private static deviceName: string = ''
  private static autoReconnect = true
  private static reconnectAttempts = 0
  private static maxReconnectAttempts = 3

  static isSupported(): boolean {
    if (typeof navigator === 'undefined') return false
    return Boolean((navigator as NavigatorWithSerial).serial)
  }

  /**
   * Get available USB devices with names
   */
  static async getAvailableDevices(): Promise<DeviceInfo[]> {
    if (!this.isSupported()) {
      return []
    }

    try {
      const ports = await (navigator as NavigatorWithSerial).serial!.getPorts()
      
      return ports.map((port, index) => {
        const info = port.getInfo?.()
        const vendorId = info?.usbVendorId
        const productId = info?.usbProductId
        
        // Try to identify device by vendor/product ID
        const deviceName = this.identifyDevice(vendorId, productId)
        
        return {
          name: deviceName,
          port: `COM${index + 3}`, // Simulated COM port name
          status: this.port === port ? 'connected' : 'disconnected',
          type: 'usb'
        }
      })
    } catch (error) {
      console.error('Failed to get available devices:', error)
      return []
    }
  }

  /**
   * Identify device by vendor/product ID
   */
  private static identifyDevice(vendorId?: number, productId?: number): string {
    // Common USB modem vendor IDs
    const deviceMap: Record<number, string> = {
      0x12d1: 'Huawei Modem', // Huawei
      0x19d2: 'ZTE Modem', // ZTE
      0x0b3c: 'Olivetti Modem',
      0x1bbb: 'T-Mobile Modem',
      0x1410: 'Novatel Modem',
      0x1199: 'Sierra Wireless Modem',
      0x413c: 'Dell Modem',
      0x03f0: 'HP Modem',
    }

    if (vendorId && deviceMap[vendorId]) {
      return deviceMap[vendorId]
    }

    return vendorId && productId 
      ? `USB Modem (VID:${vendorId.toString(16)} PID:${productId.toString(16)})`
      : 'USB Modem'
  }

  /**
   * Get current device info
   */
  static getDeviceInfo(): DeviceInfo | null {
    if (!this.port) {
      return null
    }

    return {
      name: this.deviceName || 'USB Modem',
      port: 'Connected',
      status: 'connected',
      type: 'usb'
    }
  }

  /**
   * Enable or disable auto-reconnect
   */
  static setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled
  }

  static async connect(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('USB modem sending needs a Chromium desktop browser/PWA with Web Serial support')
    }

    if (this.port && this.writer) {
      // Test if connection is still alive
      try {
        await this.command('AT')
        return // Connection is still alive
      } catch (error) {
        // Connection is dead, disconnect and reconnect
        await this.disconnect()
      }
    }

    try {
      this.port = await (navigator as NavigatorWithSerial).serial!.requestPort()
      
      // Get device info for name
      const info = this.port.getInfo?.()
      this.deviceName = this.identifyDevice(info?.usbVendorId, info?.usbProductId)
      
      await this.port.open({ baudRate: 115200 })
      this.writer = this.port.writable!.getWriter()
      this.reader = this.port.readable!.getReader()

      await this.command('AT')
      await this.command('AT+CMGF=1')
      await this.command('AT+CSCS="GSM"')
      
      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0
    } catch (error) {
      if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
        await delay(2000)
        return this.connect()
      }
      throw error
    }
  }

  static async disconnect(): Promise<void> {
    try {
      this.reader?.releaseLock()
      this.writer?.releaseLock()
      await this.port?.close()
    } finally {
      this.reader = null
      this.writer = null
      this.port = null
      this.deviceName = ''
      this.reconnectAttempts = 0
    }
  }

  static async send(phone: string, message: string): Promise<void> {
    const validation = validatePhoneNumber(phone)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    if (!message.trim()) {
      throw new Error('Message is required')
    }

    try {
      await this.connect()
      await this.command(`AT+CMGS="${phone}"`)
      await this.write(`${message}${CTRL_Z}`)
      await delay(3500)
    } catch (error) {
      // If send fails, try to reconnect if auto-reconnect is enabled
      if (this.autoReconnect) {
        await this.disconnect()
        await delay(1000)
        await this.connect()
        // Retry send
        await this.command(`AT+CMGS="${phone}"`)
        await this.write(`${message}${CTRL_Z}`)
        await delay(3500)
      } else {
        throw error
      }
    }
  }

  static async sendMany(messages: SmsMessagePreview[], onProgress?: (sent: number, total: number, errors: string[]) => void): Promise<{ sent: number; errors: string[] }> {
    const errors: string[] = []
    let sent = 0
    const ready = messages.filter(item => item.ready && item.phone)
    
    await this.connect()
    
    for (const item of ready) {
      try {
        const validation = validatePhoneNumber(item.phone!)
        if (!validation.valid) {
          errors.push(`Invalid phone number: ${item.phone} (${validation.error})`)
          continue
        }

        if (!item.message.trim()) {
          errors.push(`Empty message for: ${item.phone}`)
          continue
        }

        await this.send(item.phone!, item.message)
        sent++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Failed to send to ${item.phone}: ${errorMsg}`)
      }
      
      onProgress?.(sent, ready.length, errors)
      await delay(1000)
    }
    
    return { sent, errors }
  }

  private static async command(command: string): Promise<void> {
    await this.write(`${command}\r`)
    await delay(500)
  }

  private static async write(value: string): Promise<void> {
    if (!this.writer) throw new Error('USB modem is not connected')
    await this.writer.write(new TextEncoder().encode(value))
  }
}
