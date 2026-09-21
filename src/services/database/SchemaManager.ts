import { ConnectionManager } from './ConnectionManager'
import { TABLES, CREATE_ALL_INDEXES } from './schema'

export class SchemaManager {
  // Initialize database - create all tables and indexes
  static async initialize(): Promise<void> {
    try {
      console.log('[SchemaManager] Initializing database schema...')
      
      // Create the local schema in one transaction. Each individual execute
      // used to export and write the whole sql.js database to IndexedDB,
      // making the first page load unnecessarily slow on a fresh device.
      await ConnectionManager.transaction(
        Object.values(TABLES).map(sql => ({ sql }))
      )

      await this.ensureColumn('User', 'schoolType', 'TEXT')

      // Index creation is also persisted once. IF NOT EXISTS keeps this safe
      // across refreshes and upgrades of an existing local database.
      const indexes = CREATE_ALL_INDEXES.split(';').filter(s => s.trim())
      await ConnectionManager.transaction(indexes.map(sql => ({ sql: sql.trim() })))

      console.log('[SchemaManager] Database schema initialized successfully')
    } catch (error) {
      console.error('[SchemaManager] Failed to initialize schema:', error)
      throw error
    }
  }

  private static async ensureColumn(table: string, column: string, definition: string): Promise<void> {
    try {
      const columns = await ConnectionManager.query<{ name: string }>(`PRAGMA table_info(${table})`)
      if (!columns.some(c => c.name === column)) {
        await ConnectionManager.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
      }
    } catch (error) {
      console.warn(`[SchemaManager] Column migration warning for ${table}.${column}:`, error)
    }
  }

  // Check if database is initialized
  static async isInitialized(): Promise<boolean> {
    try {
      const tables = await ConnectionManager.query<{ name: string }>(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='School'
      `)
      return tables.length > 0
    } catch {
      return false
    }
  }

  // Drop all tables (for reset)
  static async reset(): Promise<void> {
    try {
      console.log('[SchemaManager] Resetting database...')
      
      const tables = [
        'BackupLog', 'GradingConfig', 'StudentResult', 'Tabia', 'Attendance',
        'MarksEntry', 'Exam', 'TeacherSubject', 'ClassTeacherAssignment', 'ClassSubject', 'Subject',
        'Student', 'Class', 'Teacher', 'User', 'School', 'AppSetting'
      ]

      for (const table of tables) {
        try {
          await ConnectionManager.execute(`DROP TABLE IF EXISTS ${table}`)
        } catch (error) {
          console.warn(`[SchemaManager] Error dropping table ${table}:`, error)
        }
      }

      console.log('[SchemaManager] Database reset complete')
    } catch (error) {
      console.error('[SchemaManager] Failed to reset database:', error)
      throw error
    }
  }

  // Get database statistics
  static async getStats(): Promise<{
    tables: Record<string, number>
    totalRecords: number
  }> {
    const tables = [
      'School', 'User', 'Teacher', 'Class', 'Student', 'Subject',
      'ClassSubject', 'ClassTeacherAssignment', 'TeacherSubject', 'Exam', 'MarksEntry',
      'Attendance', 'Tabia', 'StudentResult', 'GradingConfig'
    ]

    const stats: Record<string, number> = {}
    
    for (const table of tables) {
      try {
        const result = await ConnectionManager.query<{ count: number }>(
          `SELECT COUNT(*) as count FROM ${table}`
        )
        stats[table] = result[0]?.count || 0
      } catch {
        stats[table] = 0
      }
    }

    const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0)
    
    return {
      tables: stats,
      totalRecords
    }
  }
}
