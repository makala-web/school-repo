import { ConnectionManager } from '@/services/database/ConnectionManager'

// API Client - provides compatibility layer between components and repositories
// In web mode: simulates HTTP API responses
// In mobile mode: uses repositories directly

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class ApiClientClass {
  // Detect mode at runtime, not at module load
  private isWebMode(): boolean {
    if (typeof window === 'undefined') return true
    return !ConnectionManager.isMobile()
  }

  // Simulate HTTP response format for compatibility
  success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message
    }
  }

  error(message: string): ApiResponse<never> {
    return {
      success: false,
      error: message
    }
  }

  // Check if running in web or mobile mode (runtime detection)
  isWeb(): boolean {
    return this.isWebMode()
  }

  isMobile(): boolean {
    return !this.isWebMode()
  }
}

export const ApiClient = new ApiClientClass()
