// Runtime Diagnostics
// Use this to check system health at runtime

import { ConnectionManager } from '@/services/database/ConnectionManager'
import { StorageMonitor } from '@/services/device/StorageMonitor'
import { generateId } from '@/modules/validation'

export interface DiagnosticResult {
  component: string
  status: 'ok' | 'warning' | 'error'
  message: string
  details?: unknown
}

export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  // 1. Database Check
  try {
    const isMobile = ConnectionManager.isMobile()
    const testQuery = await ConnectionManager.query('SELECT 1 as test', [])
    
    results.push({
      component: 'Database',
      status: 'ok',
      message: `Connected (${isMobile ? 'SQLite' : 'Prisma'})`,
      details: { mode: isMobile ? 'mobile' : 'web', testResult: testQuery }
    })
  } catch (error) {
    results.push({
      component: 'Database',
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
      details: error
    })
  }

  // 2. Storage Check
  try {
    const storageInfo = await StorageMonitor.getFormattedStorageInfo()
    if (storageInfo) {
      const status = storageInfo.isHealthy ? 'ok' : 'warning'
      results.push({
        component: 'Storage',
        status,
        message: `${storageInfo.free} free of ${storageInfo.total}`,
        details: storageInfo
      })
    } else {
      results.push({
        component: 'Storage',
        status: 'warning',
        message: 'Storage info not available'
      })
    }
  } catch (error) {
    results.push({
      component: 'Storage',
      status: 'warning',
      message: 'Storage check failed',
      details: error
    })
  }

  // 3. UUID Generation Check
  try {
    const id1 = generateId()
    const id2 = generateId()
    const valid = id1 !== id2 && /^[0-9a-f-]{36}$/i.test(id1)
    
    results.push({
      component: 'ID Generation',
      status: valid ? 'ok' : 'error',
      message: valid ? 'Working correctly' : 'ID generation issue',
      details: { sample: id1 }
    })
  } catch (error) {
    results.push({
      component: 'ID Generation',
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed'
    })
  }

  // 4. Environment Check
  const envInfo = {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'N/A',
    hasCapacitor: typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: unknown }).Capacitor,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    timestamp: new Date().toISOString()
  }

  results.push({
    component: 'Environment',
    status: 'ok',
    message: envInfo.hasCapacitor ? 'Capacitor detected' : 'Web mode',
    details: envInfo
  })

  return results
}

// Format results for display
export function formatDiagnostics(results: DiagnosticResult[]): string {
  return results.map(r => {
    const icon = r.status === 'ok' ? '✅' : r.status === 'warning' ? '⚠️' : '❌'
    return `${icon} ${r.component}: ${r.message}`
  }).join('\n')
}

// Log to console
export async function logDiagnostics(): Promise<void> {
  console.log('🔍 Running System Diagnostics...\n')
  const results = await runDiagnostics()
  console.log(formatDiagnostics(results))
  console.log('\n📊 Full Details:', results)
}
