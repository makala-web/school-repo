/**
 * Desktop Discovery Service
 * Allows Android devices to automatically discover Desktop instances on the same network
 * Uses network scanning and WebRTC for local IP detection
 */

export interface DiscoveredDesktop {
  ip: string
  port: number
  url: string
  name?: string
  lastSeen: number
  reachable: boolean
}

export interface DiscoveryProgress {
  stage: 'scanning' | 'found' | 'complete' | 'error'
  message: string
  progress: number
  found?: DiscoveredDesktop[]
}

class DesktopDiscoveryService {
  private static discoveredDesktops: Map<string, DiscoveredDesktop> = new Map()
  private static isScanning = false
  private static scanTimeout: NodeJS.Timeout | null = null

  /**
   * Get the local IP address range for scanning
   */
  private static async getLocalIpRange(): Promise<string | null> {
    try {
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
              const ip = match[1]
              // Extract the subnet (e.g., 192.168.1 from 192.168.1.100)
              const subnet = ip.substring(0, ip.lastIndexOf('.'))
              resolve(subnet)
            }
          }
        }
        setTimeout(() => {
          rtc.close()
          resolve(null)
        }, 2000)
      })
    } catch (error) {
      console.error('Failed to get local IP range:', error)
      return null
    }
  }

  /**
   * Check if a specific IP:port is reachable
   */
  private static async checkEndpoint(ip: string, port: number): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000) // 2 second timeout

      const response = await fetch(`http://${ip}:${port}/api/qr/transfer`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response.ok || response.status === 404 // 404 means server is running but no transfer data
    } catch (error) {
      return false
    }
  }

  /**
   * Scan the local network for Desktop instances
   */
  static async scanForDesktops(
    onProgress: (progress: DiscoveryProgress) => void,
    targetPort: number = 3000
  ): Promise<DiscoveredDesktop[]> {
    if (this.isScanning) {
      return Array.from(this.discoveredDesktops.values())
    }

    this.isScanning = true
    this.discoveredDesktops.clear()

    try {
      onProgress({ stage: 'scanning', message: 'Detecting local network...', progress: 10 })

      const subnet = await this.getLocalIpRange()
      
      if (!subnet) {
        // Fallback to common subnet ranges
        onProgress({ stage: 'scanning', message: 'Trying common network ranges...', progress: 20 })
        await this.scanCommonRanges(targetPort, onProgress)
      } else {
        onProgress({ stage: 'scanning', message: `Scanning ${subnet}.x network...`, progress: 30 })
        await this.scanSubnet(subnet, targetPort, onProgress)
      }

      const found = Array.from(this.discoveredDesktops.values())
      
      if (found.length > 0) {
        onProgress({ 
          stage: 'found', 
          message: `Found ${found.length} Desktop instance(s)`, 
          progress: 100,
          found 
        })
      } else {
        onProgress({ 
          stage: 'complete', 
          message: 'No Desktop instances found on network. Make sure Desktop is running and both devices are on the same Wi-Fi.', 
          progress: 100 
        })
      }

      return found
    } catch (error) {
      onProgress({ 
        stage: 'error', 
        message: error instanceof Error ? error.message : 'Discovery failed', 
        progress: 0 
      })
      return []
    } finally {
      this.isScanning = false
    }
  }

  /**
   * Scan a specific subnet (e.g., 192.168.1)
   */
  private static async scanSubnet(
    subnet: string,
    port: number,
    onProgress: (progress: DiscoveryProgress) => void
  ): Promise<void> {
    const totalIps = 254 // .1 to .254
    let checked = 0

    // Scan IPs in batches to avoid overwhelming the network
    for (let i = 1; i <= 254; i += 10) {
      const batch: Promise<void>[] = []
      for (let j = 0; j < 10 && i + j <= 254; j++) {
        const ip = `${subnet}.${i + j}`
        batch.push(this.checkAndAddDesktop(ip, port))
      }

      await Promise.all(batch)
      checked += batch.length
      
      onProgress({ 
        stage: 'scanning', 
        message: `Scanning network... ${Math.round((checked / totalIps) * 100)}%`, 
        progress: 30 + Math.round((checked / totalIps) * 60) 
      })

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  /**
   * Scan common network ranges as fallback
   */
  private static async scanCommonRanges(
    port: number,
    onProgress: (progress: DiscoveryProgress) => void
  ): Promise<void> {
    const commonRanges = ['192.168.0', '192.168.1', '192.168.8', '192.168.10', '10.0.0']
    let checked = 0

    for (const subnet of commonRanges) {
      // Check common gateway IPs (.1, .100, .254)
      const gateways = ['1', '100', '254']
      
      for (const lastOctet of gateways) {
        const ip = `${subnet}.${lastOctet}`
        await this.checkAndAddDesktop(ip, port)
      }

      checked += gateways.length
      onProgress({ 
        stage: 'scanning', 
        message: `Checking common gateways... ${Math.round((checked / (commonRanges.length * gateways.length)) * 100)}%`, 
        progress: 20 + Math.round((checked / (commonRanges.length * gateways.length)) * 70) 
      })
    }
  }

  /**
   * Check if an IP is running Desktop and add to discovered list
   */
  private static async checkAndAddDesktop(ip: string, port: number): Promise<void> {
    const reachable = await this.checkEndpoint(ip, port)
    
    if (reachable) {
      const desktop: DiscoveredDesktop = {
        ip,
        port,
        url: `http://${ip}:${port}`,
        name: `Desktop (${ip})`,
        lastSeen: Date.now(),
        reachable: true
      }
      this.discoveredDesktops.set(ip, desktop)
    }
  }

  /**
   * Stop any ongoing discovery scan
   */
  static stopScan(): void {
    this.isScanning = false
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout)
      this.scanTimeout = null
    }
  }

  /**
   * Get discovered desktops
   */
  static getDiscoveredDesktops(): DiscoveredDesktop[] {
    return Array.from(this.discoveredDesktops.values())
  }

  /**
   * Clear discovered desktops
   */
  static clearDiscoveredDesktops(): void {
    this.discoveredDesktops.clear()
  }

  /**
   * Test if a specific desktop URL is reachable
   */
  static async testDesktopUrl(url: string): Promise<{ reachable: boolean; error?: string }> {
    try {
      const parsedUrl = new URL(url)
      
      // Check if it's localhost (won't work on Android)
      if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
        return { 
          reachable: false, 
          error: 'Cannot use localhost on Android. Use the Desktop\'s actual IP address.' 
        }
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(`${parsedUrl.origin}/api/qr/transfer`, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      return { reachable: response.ok || response.status === 404 }
    } catch (error) {
      let errorMsg = 'Cannot reach Desktop'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMsg = 'Connection timeout. Desktop not responding.'
        } else if (error.message.includes('Failed to fetch')) {
          errorMsg = 'Cannot reach Desktop. Possible causes:\n- Desktop not running\n- Different Wi-Fi network\n- Firewall blocking connection\n- Wrong IP address'
        } else {
          errorMsg = error.message
        }
      }

      return { reachable: false, error: errorMsg }
    }
  }
}

export default DesktopDiscoveryService
