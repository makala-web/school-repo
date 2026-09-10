import QRCode from 'qrcode'

export interface QrTransferData {
  id: string
  type: 'SMS_DATA'
  items: Array<{
    phone: string
    studentId: string
    studentName: string
    message: string
  }>
  timestamp: number
  sessionToken?: string
  deviceId?: string
}

export interface QrConnectionPayload {
  url: string
  desktopIp: string
  port: string
  sessionToken: string
  timestamp: number
  deviceId: string
  transferId: string
}

export interface TransferProgress {
  stage: 'connecting' | 'receiving' | 'importing' | 'completed' | 'error'
  message: string
  progress: number
}

export class QrTransferService {
  private static transferId: string | null = null

  /**
   * Get the Desktop's local IP address for QR code generation
   * This is needed because Android cannot reach localhost
   */
  private static async getLocalIpAddress(): Promise<string> {
    try {
      // Try to get local IP by checking WebRTC
      const rtc = new RTCPeerConnection({ iceServers: [] })
      rtc.createDataChannel('')
      const offer = await rtc.createOffer()
      await rtc.setLocalDescription(offer)
      
      return new Promise((resolve) => {
        rtc.onicecandidate = (event) => {
          if (event.candidate) {
            const match = event.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/)
            if (match && !match[1].startsWith('127.')) {
              rtc.close()
              resolve(match[1])
            }
          }
        }
        setTimeout(() => {
          rtc.close()
          resolve(window.location.hostname)
        }, 1000)
      })
    } catch (error) {
      console.error('Failed to get local IP:', error)
      return window.location.hostname
    }
  }

  /**
   * Get the actual base URL for QR code (using IP instead of localhost)
   */
  private static async getBaseUrl(): Promise<string> {
    const localIp = await this.getLocalIpAddress()
    const port = window.location.port || '3000'
    
    // If we're on localhost, try to use the actual IP
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `http://${localIp}:${port}`
    }
    
    return window.location.origin
  }

  /**
   * Generate QR code containing connection URL for Desktop
   */
  static async generateConnectionQr(transferId: string, sessionToken: string, deviceId: string): Promise<{ qrDataUrl: string; transferUrl: string }> {
    this.transferId = transferId

    // Get the actual base URL with IP address (not localhost)
    const baseUrl = await this.getBaseUrl()
    const parsedBaseUrl = new URL(baseUrl)
    
    // Create the transfer URL that points to the API endpoint
    const transferUrl = `${baseUrl}/api/qr/transfer?id=${transferId}&token=${encodeURIComponent(sessionToken)}`
    const qrPayload: QrConnectionPayload = {
      url: transferUrl,
      desktopIp: parsedBaseUrl.hostname,
      port: parsedBaseUrl.port || (parsedBaseUrl.protocol === 'https:' ? '443' : '80'),
      sessionToken,
      timestamp: Date.now(),
      deviceId,
      transferId,
    }
    
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })

    return { qrDataUrl, transferUrl }
  }

  /**
   * Upload SMS data to the transfer server
   */
  static async uploadTransferData(data: QrTransferData): Promise<void> {
    try {
      // Add session token and device ID if not present
      const enrichedData = {
        ...data,
        sessionToken: data.sessionToken || crypto.randomUUID(),
        deviceId: data.deviceId || this.generateDeviceId()
      }

      const response = await fetch('/api/qr/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(enrichedData)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to upload transfer data' }))
        throw new Error(error.error || 'Failed to upload transfer data')
      }

      const result = await response.json()
      console.log('Transfer data uploaded:', result)
    } catch (error) {
      console.error('Failed to upload transfer data:', error)
      throw error
    }
  }

  /**
   * Generate a unique device ID
   */
  private static generateDeviceId(): string {
    // Try to get a persistent device ID from localStorage
    if (typeof window !== 'undefined') {
      let deviceId = localStorage.getItem('shulea-device-id')
      if (!deviceId) {
        deviceId = crypto.randomUUID()
        localStorage.setItem('shulea-device-id', deviceId)
      }
      return deviceId
    }
    return crypto.randomUUID()
  }

  /**
   * Start transfer by uploading data and generating QR
   */
  static async startTransfer(data: QrTransferData): Promise<{ qrDataUrl: string; transferUrl: string }> {
    const transferId = data.id || crypto.randomUUID()
    const sessionToken = data.sessionToken || crypto.randomUUID()
    const deviceId = data.deviceId || this.generateDeviceId()

    // Upload the data first
    await this.uploadTransferData({
      ...data,
      id: transferId,
      sessionToken,
      deviceId,
    })
    
    // Generate QR code with the same transfer ID that was uploaded.
    const { qrDataUrl, transferUrl } = await this.generateConnectionQr(transferId, sessionToken, deviceId)
    
    return { qrDataUrl, transferUrl }
  }

  /**
   * Stop the transfer by deleting the data
   */
  static async stopTransfer(): Promise<void> {
    if (this.transferId) {
      try {
        await fetch(`/api/qr/transfer?id=${this.transferId}`, {
          method: 'DELETE'
        })
      } catch (error) {
        console.error('Failed to delete transfer:', error)
      }
      this.transferId = null
    }
  }

  /**
   * Receive data from Desktop on Android
   */
  static async receiveFromDesktop(url: string, onProgress: (progress: TransferProgress) => void): Promise<QrTransferData> {
    onProgress({ stage: 'connecting', message: 'Connecting to Desktop...', progress: 10 })

    try {
      const parsedPayload = this.parseQrOrUrl(url)
      const transferUrl = parsedPayload.url
      const sessionToken = parsedPayload.sessionToken

      if (Date.now() - parsedPayload.timestamp > 10 * 60 * 1000) {
        throw new Error('Invalid QR: this QR code is too old. Generate a new QR code on Desktop and scan again.')
      }

      // Validate URL format
      let parsedUrl: URL
      try {
        parsedUrl = new URL(transferUrl)
      } catch {
        throw new Error('Invalid Desktop URL format. Please enter a valid URL (e.g., http://192.168.1.100:3000/api/qr/transfer?id=xxx)')
      }

      // Check network connectivity
      if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your Wi-Fi connection.')
      }

      // Check if URL uses localhost (which won't work on Android)
      if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
        throw new Error('Desktop URL uses localhost. Android cannot reach localhost.\n\nTo fix this:\n1. On Desktop, open Command Prompt and run: ipconfig\n2. Look for "IPv4 Address" (e.g., 192.168.1.100)\n3. Use that IP instead of localhost\n4. Example: http://192.168.1.100:3000/api/qr/transfer?id=xxx\n\nBoth devices must be on the same Wi-Fi network.')
      }

      onProgress({ stage: 'connecting', message: 'Connecting to Desktop server...', progress: 20 })

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      try {
        const response = await fetch(transferUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Transfer not found or expired. The QR code may be too old. Please scan a new QR code.')
          } else if (response.status === 410) {
            throw new Error('Transfer expired. Please scan a new QR code from Desktop.')
          } else if (response.status === 500) {
            throw new Error('Desktop server error. Please check if Desktop app is running correctly.')
          } else {
            throw new Error(`Desktop server returned error ${response.status}. Please check Desktop connection.`)
          }
        }

        onProgress({ stage: 'receiving', message: 'Receiving SMS data...', progress: 50 })

        const data = await response.json()

        onProgress({ stage: 'importing', message: 'Importing SMS data...', progress: 80 })

        // Validate data structure
        if (!data.type || data.type !== 'SMS_DATA' || !Array.isArray(data.items)) {
          throw new Error('Invalid data format received from Desktop. Please try again.')
        }

        if (data.items.length === 0) {
          throw new Error('No SMS data received from Desktop. Please check if you have SMS data to transfer.')
        }

        if (sessionToken && data.sessionToken && sessionToken !== data.sessionToken) {
          throw new Error('Wrong session. The QR token does not match the Desktop transfer session. Generate a new QR code and scan again.')
        }

        onProgress({ stage: 'completed', message: `Successfully received ${data.items.length} SMS records`, progress: 100 })

        return data
      } catch (error) {
        clearTimeout(timeoutId)
        
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error('Connection timeout. Desktop server not responding. Please check if Desktop is running and on the same Wi-Fi network.')
          }
          if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot reach Desktop server. Possible causes:\n1. Desktop app is not running\n2. Desktop and Android are not on the same Wi-Fi network\n3. Firewall is blocking the connection\n4. Desktop URL is incorrect\n\nPlease ensure Desktop is running on port 3000 and both devices are on the same Wi-Fi network.')
          }
          throw error
        }
        throw new Error('Unknown connection error. Please check Desktop connection and try again.')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transfer failed'
      onProgress({ stage: 'error', message: errorMessage, progress: 0 })
      throw error
    }
  }

  private static parseQrOrUrl(input: string): QrConnectionPayload {
    const trimmed = input.trim()

    try {
      const parsed = JSON.parse(trimmed) as Partial<QrConnectionPayload>
      if (!parsed.url || !parsed.transferId || !parsed.sessionToken) {
        throw new Error('Invalid QR: missing Desktop URL, transfer ID, or session token.')
      }

      return {
        url: parsed.url,
        desktopIp: parsed.desktopIp || new URL(parsed.url).hostname,
        port: parsed.port || new URL(parsed.url).port || '3000',
        sessionToken: parsed.sessionToken,
        timestamp: Number(parsed.timestamp || Date.now()),
        deviceId: parsed.deviceId || 'desktop',
        transferId: parsed.transferId,
      }
    } catch (error) {
      if (trimmed.startsWith('{')) {
        throw error instanceof Error ? error : new Error('Invalid QR code payload.')
      }
    }

    const parsedUrl = new URL(trimmed)
    return {
      url: trimmed,
      desktopIp: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80'),
      sessionToken: parsedUrl.searchParams.get('token') || '',
      timestamp: Date.now(),
      deviceId: 'manual',
      transferId: parsedUrl.searchParams.get('id') || '',
    }
  }

  /**
   * Check if running on Desktop
   */
  static isDesktop(): boolean {
    return typeof window !== 'undefined' && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  }

  /**
   * Check if running on Android
   */
  static isAndroid(): boolean {
    return typeof window !== 'undefined' && /Android/i.test(navigator.userAgent)
  }
}
