import type { SmsMessagePreview } from './SmsResultsService'

export interface WifiModemConfig {
  ipAddress: string
  port?: number
  username?: string
  password?: string
  modemType?: 'huawei' | 'zte' | 'vodafone' | 'tplink' | 'generic'
}

export interface WifiModemStatus {
  connected: boolean
  ipAddress?: string
  modemType?: string
  signalStrength?: number
  error?: string
}

const DEFAULT_PORT = 80
const COMMON_MODEM_IPS = [
  '192.168.0.1',
  '192.168.1.1',
  '192.168.8.1',
  '192.168.100.1',
  '192.168.10.1'
]

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

export class WifiModemSender {
  private static config: WifiModemConfig | null = null
  private static isConnected = false

  /**
   * Auto-discover Wi-Fi modem on local network
   */
  static async discoverModem(): Promise<string | null> {
    for (const ip of COMMON_MODEM_IPS) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000) // 2 second timeout per IP

        const response = await fetch(`http://${ip}`, {
          method: 'GET',
          mode: 'no-cors',
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (response.ok || response.type === 'opaque') {
          console.log(`Found modem at ${ip}`)
          return ip
        }
      } catch (error) {
        // Continue to next IP
        continue
      }
    }

    return null
  }

  /**
   * Test connection to a specific modem IP
   */
  static async testConnection(ip: string, port: number = DEFAULT_PORT): Promise<WifiModemStatus> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(`http://${ip}:${port}`, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok || response.type === 'opaque') {
        return {
          connected: true,
          ipAddress: ip,
          modemType: 'generic'
        }
      }

      return {
        connected: false,
        ipAddress: ip,
        error: `Connection failed with status ${response.status}`
      }
    } catch (error) {
      return {
        connected: false,
        ipAddress: ip,
        error: this.describeConnectionError(error)
      }
    }
  }

  /**
   * Connect to Wi-Fi modem
   */
  static async connect(config: WifiModemConfig): Promise<void> {
    this.config = config

    // Test connection
    const status = await this.testConnection(config.ipAddress, config.port || DEFAULT_PORT)
    
    if (!status.connected) {
      throw new Error(status.error || 'Failed to connect to Wi-Fi modem')
    }

    this.isConnected = true
    console.log('Connected to Wi-Fi modem at', config.ipAddress)
  }

  /**
   * Disconnect from Wi-Fi modem
   */
  static async disconnect(): Promise<void> {
    this.isConnected = false
    this.config = null
    console.log('Disconnected from Wi-Fi modem')
  }

  /**
   * Get current connection status
   */
  static getStatus(): WifiModemStatus {
    if (!this.isConnected || !this.config) {
      return { connected: false }
    }

    return {
      connected: true,
      ipAddress: this.config.ipAddress,
      modemType: this.config.modemType || 'generic'
    }
  }

  /**
   * Send SMS via Wi-Fi modem HTTP API
   * Note: This is a generic implementation. Specific modem implementations may vary.
   */
  static async send(phone: string, message: string): Promise<void> {
    if (!this.isConnected || !this.config) {
      throw new Error('Wi-Fi modem is not connected')
    }

    const validation = validatePhoneNumber(phone)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    if (!message.trim()) {
      throw new Error('Message is required')
    }

    const port = this.config.port || DEFAULT_PORT
    const baseUrl = `http://${this.config.ipAddress}:${port}`

    // Try different API endpoints based on modem type
    const endpoints = this.getSmsEndpoints(this.config.modemType || 'generic')

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            phone,
            message,
            ...(this.config.username && { username: this.config.username }),
            ...(this.config.password && { password: this.config.password })
          })
        })

        if (response.ok || response.type === 'opaque') {
          console.log('SMS sent successfully via Wi-Fi modem')
          return
        }
      } catch (error) {
        console.error(`Failed to send via ${endpoint}:`, error)
        continue
      }
    }

    throw new Error('Failed to send SMS via Wi-Fi modem. Modem may not support HTTP SMS API.')
  }

  private static describeConnectionError(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return 'Connection timeout. Check modem IP address and make sure you are connected to the modem Wi-Fi.'
      }
      if (error.message.includes('Failed to fetch')) {
        return 'Cannot reach Wi-Fi modem. Possible causes: wrong IP address, different Wi-Fi network, modem web interface disabled, or browser blocked the request.'
      }
      return error.message
    }
    return 'Connection failed'
  }

  /**
   * Send multiple SMS messages
   */
  static async sendMany(messages: SmsMessagePreview[], onProgress?: (sent: number, total: number, errors: string[]) => void): Promise<{ sent: number; errors: string[] }> {
    const errors: string[] = []
    let sent = 0
    const ready = messages.filter(item => item.ready && item.phone)
    
    if (!this.isConnected) {
      await this.connect(this.config!)
    }
    
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

  /**
   * Get SMS API endpoints based on modem type
   */
  private static getSmsEndpoints(modemType: string): string[] {
    const endpoints: Record<string, string[]> = {
      huawei: ['/api/sms/send', '/sms/send', '/send-sms'],
      zte: ['/api/sms/send', '/sms/send', '/send-sms'],
      vodafone: ['/api/sms/send', '/sms/send'],
      tplink: ['/api/sms/send', '/sms/send'],
      generic: ['/api/sms/send', '/sms/send', '/send-sms', '/api/send-sms']
    }

    return endpoints[modemType] || endpoints.generic
  }

  /**
   * Check if Wi-Fi modem is supported
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && typeof fetch !== 'undefined'
  }
}
