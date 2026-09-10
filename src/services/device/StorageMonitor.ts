// Storage Monitor Service (Web-only)
// Monitors browser storage space and warns when running low
// Uses Quota Management API for web browsers

import { toast } from 'sonner'

export interface StorageInfo {
  total: number // Total storage in bytes
  free: number    // Free storage in bytes
  used: number    // Used storage in bytes
  percentUsed: number // Percentage used (0-100)
}

export class StorageMonitor {
  private static WARNING_THRESHOLD = 85 // Warn at 85% full
  private static CRITICAL_THRESHOLD = 95 // Critical at 95% full
  private static readonly DB_SIZE_ESTIMATE = 50 * 1024 * 1024 // ~50MB for database
  private static readonly MIN_FREE_SPACE = 100 * 1024 * 1024 // 100MB minimum recommended

  // Get storage information
  static async getStorageInfo(): Promise<StorageInfo | null> {
    try {
      const info = await this.estimateStorageSpace()
      return info
    } catch (error) {
      console.error('[StorageMonitor] Failed to get storage info:', error)
      return null
    }
  }

  // Estimate storage space using Quota Management API
  private static async estimateStorageSpace(): Promise<StorageInfo> {
    try {
      const nav = navigator as Navigator & { storage?: { estimate(): Promise<StorageEstimate> } }
      
      if (nav.storage && nav.storage.estimate) {
        const estimate = await nav.storage.estimate()
        const details = estimate as StorageEstimate & { usageDetails?: { indexedDB?: number } }
        const total = details.usageDetails?.indexedDB || estimate.usage || 0
        const quota = estimate.quota || 0
        
        // Estimate free space
        const used = estimate.usage || 0
        const free = quota > 0 ? quota - used : Math.max(0, 500 * 1024 * 1024 - used) // Assume 500MB if can't detect
        
        return {
          total: quota || 500 * 1024 * 1024,
          free: Math.max(0, free),
          used: used,
          percentUsed: quota > 0 ? Math.round((used / quota) * 100) : 0
        }
      }

      // Fallback: return estimated values
      return {
        total: 1000 * 1024 * 1024, // 1GB estimated
        free: 500 * 1024 * 1024,   // 500MB estimated
        used: 500 * 1024 * 1024,   // 500MB estimated
        percentUsed: 50
      }
    } catch (error) {
      console.warn('[StorageMonitor] Storage estimation failed:', error)
      
      // Return safe defaults
      return {
        total: 0,
        free: 0,
        used: 0,
        percentUsed: 0
      }
    }
  }

  // Check storage and warn if low
  static async checkAndWarn(): Promise<boolean> {
    const info = await this.getStorageInfo()
    
    if (!info) {
      console.warn('[StorageMonitor] Could not get storage info')
      return true // Assume OK if we can't check
    }

    // Critical - less than minimum required
    if (info.free < this.MIN_FREE_SPACE) {
      toast.error(
        `Storage critically low! Only ${this.formatBytes(info.free)} remaining. ` +
        `Please free up space or export data.`,
        { duration: 10000 }
      )
      return false
    }

    // Critical percentage
    if (info.percentUsed >= this.CRITICAL_THRESHOLD) {
      toast.error(
        `Storage ${info.percentUsed}% full! Critical level reached. ` +
        `Please backup and free up space immediately.`,
        { duration: 10000 }
      )
      return false
    }

    // Warning percentage
    if (info.percentUsed >= this.WARNING_THRESHOLD) {
      toast.warning(
        `Storage ${info.percentUsed}% full. Consider backing up and clearing old data.`,
        { duration: 8000 }
      )
    }

    return true
  }

  // Format bytes to human readable
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Get formatted storage info for display
  static async getFormattedStorageInfo(): Promise<{
    total: string
    used: string
    free: string
    percentUsed: number
    isHealthy: boolean
  } | null> {
    const info = await this.getStorageInfo()
    if (!info) return null

    return {
      total: this.formatBytes(info.total),
      used: this.formatBytes(info.used),
      free: this.formatBytes(info.free),
      percentUsed: info.percentUsed,
      isHealthy: info.percentUsed < this.WARNING_THRESHOLD && info.free >= this.MIN_FREE_SPACE
    }
  }

  // Start periodic monitoring
  static startMonitoring(intervalMinutes = 30): void {
    // Check immediately
    this.checkAndWarn()

    // Set up periodic checks
    setInterval(() => {
      this.checkAndWarn()
    }, intervalMinutes * 60 * 1000)

    console.log(`[StorageMonitor] Started monitoring every ${intervalMinutes} minutes`)
  }

  // Estimate database size
  static async estimateDatabaseSize(): Promise<number> {
    // This is a rough estimate based on record counts
    // In a real implementation, you might check actual file sizes
    return this.DB_SIZE_ESTIMATE
  }
}
