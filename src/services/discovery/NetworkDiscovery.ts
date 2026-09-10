export interface DiscoveredDevice {
  ip: string
  port: number
  name: string
  available: boolean
  latency?: number
}

export interface DiscoveryResult {
  devices: DiscoveredDevice[]
  bestDevice?: DiscoveredDevice
  error?: string
}

const COMMON_PORTS = [3000, 8080, 80, 443]
const DISCOVERY_TIMEOUT = 5000 // 5 seconds per IP

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get local IP address using WebRTC
 */
async function getLocalIpAddress(): Promise<string> {
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
            resolve(match[1])
          }
        }
      }
      setTimeout(() => {
        rtc.close()
        resolve('localhost')
      }, 1000)
    })
  } catch (error) {
    console.error('Failed to get local IP:', error)
    return 'localhost'
  }
}

/**
 * Get local network segment from IP
 */
function getNetworkSegment(ip: string): string {
  const parts = ip.split('.')
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`
  }
  return '192.168.1'
}

/**
 * Check if a specific IP:port is reachable
 */
async function checkDevice(ip: string, port: number): Promise<DiscoveredDevice | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT)

    const startTime = Date.now()
    const response = await fetch(`http://${ip}:${port}`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache'
    })
    
    clearTimeout(timeoutId)
    const latency = Date.now() - startTime

    if (response.ok || response.status === 404) {
      // Device is reachable (404 means server is running but route doesn't exist)
      return {
        ip,
        port,
        name: `Device at ${ip}:${port}`,
        available: true,
        latency
      }
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * Discover Shulea Desktop on local network
 */
export class NetworkDiscovery {
  /**
   * Discover Desktop devices on local network
   */
  static async discoverDesktop(): Promise<DiscoveryResult> {
    try {
      // Get local IP to determine network segment
      const localIp = await getLocalIpAddress()
      const networkSegment = getNetworkSegment(localIp)

      console.log(`Discovering devices on network segment: ${networkSegment}.0/24`)

      const discoveredDevices: DiscoveredDevice[] = []
      
      // Scan common IP range (1-254)
      // Limit to first 50 IPs for performance
      const ipRange = Array.from({ length: 50 }, (_, i) => i + 1)
      
      for (const i of ipRange) {
        const ip = `${networkSegment}.${i}`
        
        // Skip our own IP and common network addresses
        if (ip === localIp || ip.endsWith('.0') || ip.endsWith('.255')) {
          continue
        }

        // Check each common port
        for (const port of COMMON_PORTS) {
          const device = await checkDevice(ip, port)
          if (device) {
            // Try to identify if it's Shulea by checking the response
            try {
              const response = await fetch(`http://${ip}:${port}/api/shulea/auth`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000)
              })
              
              if (response.status === 401 || response.status === 405) {
                // Shulea API endpoint exists (401 = unauthorized, 405 = method not allowed)
                device.name = 'Shulea Desktop'
                discoveredDevices.push(device)
                break // Found Shulea, don't check other ports
              } else {
                discoveredDevices.push(device)
              }
            } catch {
              // Not Shulea, but still a device
              discoveredDevices.push(device)
            }
          }
        }

        // Small delay between IPs to avoid overwhelming network
        await delay(50)
      }

      // Find best device (lowest latency and named Shulea)
      const bestDevice = discoveredDevices
        .filter(d => d.name === 'Shulea Desktop')
        .sort((a, b) => (a.latency || Infinity) - (b.latency || Infinity))[0] ||
        discoveredDevices.sort((a, b) => (a.latency || Infinity) - (b.latency || Infinity))[0]

      return {
        devices: discoveredDevices,
        bestDevice
      }
    } catch (error) {
      return {
        devices: [],
        error: error instanceof Error ? error.message : 'Discovery failed'
      }
    }
  }

  /**
   * Quick discovery - only check common gateway IPs
   */
  static async quickDiscover(): Promise<DiscoveredDevice | null> {
    const commonGateways = [
      '192.168.0.1',
      '192.168.1.1',
      '192.168.8.1',
      '192.168.100.1',
      '192.168.10.1'
    ]

    for (const ip of commonGateways) {
      for (const port of COMMON_PORTS) {
        const device = await checkDevice(ip, port)
        if (device) {
          // Check if it's Shulea
          try {
            const response = await fetch(`http://${ip}:${port}/api/shulea/auth`, {
              method: 'GET',
              signal: AbortSignal.timeout(2000)
            })
            
            if (response.status === 401 || response.status === 405) {
              device.name = 'Shulea Desktop'
              return device
            }
          } catch {
            continue
          }
        }
      }
    }

    return null
  }

  /**
   * Test if a specific Desktop URL is reachable
   */
  static async testDesktopUrl(url: string): Promise<{ reachable: boolean; error?: string; latency?: number }> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const startTime = Date.now()
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      const latency = Date.now() - startTime

      return {
        reachable: response.ok || response.status === 404,
        latency
      }
    } catch (error) {
      let errorMessage = 'Cannot reach Desktop server'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Connection timeout. Desktop server not responding.'
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Cannot reach Desktop server. Possible causes:\n1. Desktop app is not running\n2. Desktop and Android are not on the same Wi-Fi network\n3. Firewall is blocking the connection\n4. Desktop URL is incorrect'
        }
      }

      return {
        reachable: false,
        error: errorMessage
      }
    }
  }

  /**
   * Get local network info
   */
  static async getNetworkInfo(): Promise<{ localIp: string; networkSegment: string }> {
    const localIp = await getLocalIpAddress()
    const networkSegment = getNetworkSegment(localIp)
    
    return {
      localIp,
      networkSegment
    }
  }
}
