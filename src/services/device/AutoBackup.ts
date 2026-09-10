// Auto-Backup Service (Web-only)
// Automatically backs up data at scheduled intervals
// Stores backup history and manages retention using localStorage

import { toast } from 'sonner'
import { ConnectionManager } from '@/services/database/ConnectionManager'
import { useAppStore } from '@/lib/store'
import { StorageMonitor } from './StorageMonitor'

export interface BackupConfig {
  enabled: boolean
  intervalDays: number // 1, 7, 30 days
  keepCount: number    // How many backups to keep (default: 5)
  includeReports: boolean
  autoShare: boolean   // Auto prompt to share after backup
}

export interface BackupInfo {
  id: string
  timestamp: string
  size: number
  type: 'manual' | 'auto'
  description: string
  data: unknown
}

const BACKUP_CONFIG_KEY = 'shulea_backup_config'
const BACKUP_HISTORY_KEY = 'shulea_backup_history'
const LAST_BACKUP_KEY = 'shulea_last_backup'

function scopedKey(baseKey: string): string {
  const user = useAppStore.getState().currentUser
  const userId = user?.id || 'guest'
  const schoolId = user?.schoolId || 'no-school'
  return `${baseKey}:${userId}:${schoolId}`
}

function currentSchoolId(): string {
  const state = useAppStore.getState()
  const schoolId = state.currentUser?.schoolId || state.currentSchool?.id
  if (!schoolId) {
    throw new Error('No active school selected for backup')
  }
  return schoolId
}

export class AutoBackup {
  private static DEFAULT_CONFIG: BackupConfig = {
    enabled: true,
    intervalDays: 7, // Weekly backups
    keepCount: 5,
    includeReports: true,
    autoShare: false
  }

  // Get backup configuration
  static async getConfig(): Promise<BackupConfig> {
    try {
      const result = localStorage.getItem(scopedKey(BACKUP_CONFIG_KEY))
      if (result) {
        return JSON.parse(result) as BackupConfig
      }
      return { ...this.DEFAULT_CONFIG }
    } catch {
      return { ...this.DEFAULT_CONFIG }
    }
  }

  // Save backup configuration
  static async saveConfig(config: BackupConfig): Promise<void> {
    try {
      localStorage.setItem(scopedKey(BACKUP_CONFIG_KEY), JSON.stringify(config))
    } catch (error) {
      console.error('[AutoBackup] Failed to save config:', error)
      throw new Error('Failed to save backup configuration')
    }
  }

  // Get backup history
  static async getBackupHistory(): Promise<BackupInfo[]> {
    try {
      const result = localStorage.getItem(scopedKey(BACKUP_HISTORY_KEY))
      if (result) {
        return JSON.parse(result) as BackupInfo[]
      }
      return []
    } catch {
      return []
    }
  }

  // Save backup history
  private static async saveBackupHistory(history: BackupInfo[]): Promise<void> {
    try {
      localStorage.setItem(scopedKey(BACKUP_HISTORY_KEY), JSON.stringify(history))
    } catch (error) {
      console.error('[AutoBackup] Failed to save history:', error)
    }
  }

  // Create backup
  static async createBackup(
    type: 'manual' | 'auto' = 'manual',
    description?: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      // Check storage first
      const storageOK = await StorageMonitor.checkAndWarn()
      if (!storageOK) {
        return { success: false, error: 'Insufficient storage space' }
      }

      // Generate backup data
      const backupData = await this.generateBackupData()
      
      // Create filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `shulea_backup_${timestamp}.json`

      // Write backup file
      const backupContent = JSON.stringify(backupData, null, 2)
      
      // Download the backup file
      const blob = new Blob([backupContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Save to history
      const history = await this.getBackupHistory()
      const backupInfo: BackupInfo = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        size: backupContent.length,
        type,
        description: description || `Backup created on ${new Date().toLocaleString()}`,
        data: {
          filename,
          recordCounts: backupData.stats
        }
      }

      // Add to history and maintain retention
      history.unshift(backupInfo)
      const config = await this.getConfig()
      if (history.length > config.keepCount) {
        // Remove old backups from history
        history.splice(config.keepCount)
      }
      await this.saveBackupHistory(history)

      // Save last backup time
      localStorage.setItem(scopedKey(LAST_BACKUP_KEY), JSON.stringify({ timestamp: new Date().toISOString() }))

      toast.success(`Backup created: ${filename}`, { duration: 5000 })
      
      return { 
        success: true, 
        filePath: filename 
      }

    } catch (error) {
      console.error('[AutoBackup] Failed to create backup:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Backup failed: ${errorMsg}`)
      return { success: false, error: errorMsg }
    }
  }

  // Generate backup data from database
  private static async generateBackupData(): Promise<{
    version: string
    timestamp: string
    data: Record<string, unknown[]>
    stats: Record<string, number>
  }> {
    const conn = ConnectionManager
    const schoolId = currentSchoolId()
    const tables = [
      'School', 'User', 'Teacher', 'Class', 'Student', 'Subject',
      'Exam', 'MarksEntry', 'Attendance', 'Tabia', 'StudentResult',
      'GradingConfig', 'AppSetting'
    ]

    const scopedQueries: Record<string, { sql: string; params: unknown[] }> = {
      School: { sql: 'SELECT * FROM School WHERE id = ?', params: [schoolId] },
      User: { sql: 'SELECT * FROM User WHERE schoolId = ?', params: [schoolId] },
      Teacher: { sql: 'SELECT * FROM Teacher WHERE schoolId = ?', params: [schoolId] },
      Class: { sql: 'SELECT * FROM Class WHERE schoolId = ?', params: [schoolId] },
      Student: { sql: 'SELECT * FROM Student WHERE schoolId = ?', params: [schoolId] },
      Subject: { sql: 'SELECT * FROM Subject WHERE schoolId = ?', params: [schoolId] },
      Exam: { sql: 'SELECT * FROM Exam WHERE schoolId = ?', params: [schoolId] },
      MarksEntry: {
        sql: 'SELECT m.* FROM MarksEntry m INNER JOIN Student s ON s.id = m.studentId WHERE s.schoolId = ?',
        params: [schoolId],
      },
      Attendance: {
        sql: 'SELECT a.* FROM Attendance a INNER JOIN Student s ON s.id = a.studentId WHERE s.schoolId = ?',
        params: [schoolId],
      },
      Tabia: {
        sql: 'SELECT t.* FROM Tabia t INNER JOIN Student s ON s.id = t.studentId WHERE s.schoolId = ?',
        params: [schoolId],
      },
      StudentResult: {
        sql: 'SELECT r.* FROM StudentResult r INNER JOIN Class c ON c.id = r.classId WHERE c.schoolId = ?',
        params: [schoolId],
      },
      GradingConfig: { sql: 'SELECT * FROM GradingConfig WHERE schoolId = ?', params: [schoolId] },
      AppSetting: { sql: 'SELECT * FROM AppSetting', params: [] },
    }

    const data: Record<string, unknown[]> = {}
    const stats: Record<string, number> = {}

    for (const table of tables) {
      try {
        const query = scopedQueries[table]
        const rows = await conn.query(query.sql, query.params)
        data[table] = rows
        stats[table] = rows.length
      } catch (error) {
        console.warn(`[AutoBackup] Could not backup table ${table}:`, error)
        data[table] = []
        stats[table] = 0
      }
    }

    return {
      version: '2.1',
      timestamp: new Date().toISOString(),
      data,
      stats
    }
  }

  // Share backup file (web-only - download instead)
  static async shareBackup(fileUri: string, filename: string): Promise<void> {
    // Web-only: file is already downloaded, no sharing needed
    console.log('[AutoBackup] Backup file downloaded:', filename)
  }

  // Check if backup is due
  static async isBackupDue(): Promise<boolean> {
    try {
      const config = await this.getConfig()
      if (!config.enabled) return false

      // Read last backup time
      let lastBackup: string | null = null
      try {
        const result = localStorage.getItem(scopedKey(LAST_BACKUP_KEY))
        if (result) {
          const data = JSON.parse(result)
          lastBackup = data.timestamp
        }
      } catch {
        return true // No previous backup
      }

      if (!lastBackup) return true

      // Check if interval has passed
      const lastDate = new Date(lastBackup)
      const now = new Date()
      const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      
      return diffDays >= config.intervalDays

    } catch (error) {
      console.error('[AutoBackup] Failed to check backup status:', error)
      return false
    }
  }

  // Run auto-backup if due
  static async runAutoBackupIfDue(): Promise<boolean> {
    const isDue = await this.isBackupDue()
    if (!isDue) return false

    console.log('[AutoBackup] Running scheduled backup...')
    const result = await this.createBackup('auto', 'Scheduled automatic backup')
    return result.success
  }

  // Start auto-backup scheduler
  static startScheduler(checkIntervalHours = 1): void {
    // Check immediately
    this.runAutoBackupIfDue()

    // Schedule periodic checks
    setInterval(() => {
      this.runAutoBackupIfDue()
    }, checkIntervalHours * 60 * 60 * 1000)

    console.log(`[AutoBackup] Scheduler started (checking every ${checkIntervalHours} hours)`)
  }

  // Get next scheduled backup time
  static async getNextBackupTime(): Promise<Date | null> {
    try {
      const config = await this.getConfig()
      if (!config.enabled) return null

      let lastBackup: string | null = null
      try {
        const result = localStorage.getItem(scopedKey(LAST_BACKUP_KEY))
        if (result) {
          const data = JSON.parse(result)
          lastBackup = data.timestamp
        }
      } catch {
        return new Date() // Now if no previous backup
      }

      if (!lastBackup) return new Date()

      const lastDate = new Date(lastBackup)
      const nextDate = new Date(lastDate.getTime() + config.intervalDays * 24 * 60 * 60 * 1000)
      return nextDate

    } catch (error) {
      console.error('[AutoBackup] Failed to get next backup time:', error)
      return null
    }
  }

  // Delete backup (remove from history only, keeps file for safety)
  static async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const history = await this.getBackupHistory()
      const filtered = history.filter(b => b.id !== backupId)
      
      if (filtered.length === history.length) {
        return false // Not found
      }

      await this.saveBackupHistory(filtered)
      return true

    } catch (error) {
      console.error('[AutoBackup] Failed to delete backup:', error)
      return false
    }
  }
}
