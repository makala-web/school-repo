import { ConnectionManager } from '@/services/database/ConnectionManager'
import { generateId } from '@/modules/validation'
import { ApiClient, type ApiResponse } from './ApiClient'

const BACKUP_TABLES = [
  ['schools', 'School'],
  ['users', 'User'],
  ['teachers', 'Teacher'],
  ['classes', 'Class'],
  ['students', 'Student'],
  ['subjects', 'Subject'],
  ['classSubjects', 'ClassSubject'],
  ['teacherSubjects', 'TeacherSubject'],
  ['exams', 'Exam'],
  ['marksEntries', 'MarksEntry'],
  ['attendance', 'Attendance'],
  ['tabia', 'Tabia'],
  ['studentResults', 'StudentResult'],
  ['gradingConfigs', 'GradingConfig'],
  ['backupLogs', 'BackupLog'],
  ['appSettings', 'AppSetting'],
] as const

type BackupStats = Record<
  'schools' | 'classes' | 'students' | 'teachers' | 'subjects' | 'exams' |
  'marksEntries' | 'studentResults' | 'users' | 'attendance' | 'tabia' | 'gradingConfigs' | 'backupLogs',
  number
>

type BackupPayload = Record<string, unknown>

const REQUIRED_BACKUP_KEYS = BACKUP_TABLES.map(([key]) => key)

function validateBackupPayload(backup: BackupPayload): string | null {
  if (!backup.version || typeof backup.version !== 'string') {
    return 'Invalid backup file: missing version'
  }

  const hasAnyTable = REQUIRED_BACKUP_KEYS.some(key => Array.isArray(backup[key]))
  if (!hasAnyTable) {
    return 'Invalid backup file: no supported tables found'
  }

  for (const key of REQUIRED_BACKUP_KEYS) {
    const records = backup[key]
    if (records !== undefined && !Array.isArray(records)) {
      return `Invalid backup file: ${key} must be an array`
    }
  }

  return null
}

function scopedSelect(tableName: string, schoolId?: string) {
  if (!schoolId) return { sql: `SELECT * FROM ${tableName}`, params: [] as unknown[] }

  switch (tableName) {
    case 'School':
      return { sql: 'SELECT * FROM School WHERE id = ?', params: [schoolId] }
    case 'User':
    case 'Teacher':
    case 'Class':
    case 'Student':
    case 'Subject':
    case 'Exam':
    case 'GradingConfig':
      return { sql: `SELECT * FROM ${tableName} WHERE schoolId = ?`, params: [schoolId] }
    case 'ClassSubject':
      return {
        sql: 'SELECT cs.* FROM ClassSubject cs INNER JOIN Class c ON c.id = cs.classId WHERE c.schoolId = ?',
        params: [schoolId],
      }
    case 'TeacherSubject':
      return {
        sql: 'SELECT ts.* FROM TeacherSubject ts INNER JOIN Class c ON c.id = ts.classId WHERE c.schoolId = ?',
        params: [schoolId],
      }
    case 'MarksEntry':
      return {
        sql: 'SELECT m.* FROM MarksEntry m INNER JOIN Student s ON s.id = m.studentId WHERE s.schoolId = ?',
        params: [schoolId],
      }
    case 'Attendance':
      return {
        sql: 'SELECT a.* FROM Attendance a INNER JOIN Student s ON s.id = a.studentId WHERE s.schoolId = ?',
        params: [schoolId],
      }
    case 'Tabia':
      return {
        sql: 'SELECT t.* FROM Tabia t INNER JOIN Student s ON s.id = t.studentId WHERE s.schoolId = ?',
        params: [schoolId],
      }
    case 'StudentResult':
      return {
        sql: 'SELECT r.* FROM StudentResult r INNER JOIN Student s ON s.id = r.studentId WHERE s.schoolId = ?',
        params: [schoolId],
      }
    case 'BackupLog':
    case 'AppSetting':
      return { sql: `SELECT * FROM ${tableName} WHERE 1 = 0`, params: [] as unknown[] }
    default:
      return { sql: `SELECT * FROM ${tableName} WHERE 1 = 0`, params: [] as unknown[] }
  }
}

async function tableCount(tableName: string, schoolId?: string): Promise<number> {
  const { sql, params } = scopedSelect(tableName, schoolId)
  const rows = await ConnectionManager.query<{ count: number }>(`SELECT COUNT(*) as count FROM (${sql}) scoped_count`, params)
  return Number(rows[0]?.count || 0)
}

async function getStats(schoolId?: string): Promise<BackupStats> {
  const [
    schools,
    classes,
    students,
    teachers,
    subjects,
    exams,
    marksEntries,
    studentResults,
    users,
    attendance,
    tabia,
    gradingConfigs,
    backupLogs,
  ] = await Promise.all([
    tableCount('School', schoolId),
    tableCount('Class', schoolId),
    tableCount('Student', schoolId),
    tableCount('Teacher', schoolId),
    tableCount('Subject', schoolId),
    tableCount('Exam', schoolId),
    tableCount('MarksEntry', schoolId),
    tableCount('StudentResult', schoolId),
    tableCount('User', schoolId),
    tableCount('Attendance', schoolId),
    tableCount('Tabia', schoolId),
    tableCount('GradingConfig', schoolId),
    tableCount('BackupLog', schoolId),
  ])

  return {
    schools,
    classes,
    students,
    teachers,
    subjects,
    exams,
    marksEntries,
    studentResults,
    users,
    attendance,
    tabia,
    gradingConfigs,
    backupLogs,
  }
}

function upsertStatement(tableName: string, record: Record<string, unknown>) {
  const columns = Object.keys(record)
  const placeholders = columns.map(() => '?').join(', ')
  const updates = columns
    .filter(column => column !== 'id')
    .map(column => `${column} = excluded.${column}`)
    .join(', ')

  return {
    sql: `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates || 'id = excluded.id'}`,
    params: columns.map(column => record[column]),
  }
}

export const BackupApi = {
  async stats(schoolId?: string): Promise<ApiResponse<{ stats: BackupStats }>> {
    try {
      if (!schoolId) {
        return ApiClient.error('School ID is required for isolated backup statistics')
      }
      return ApiClient.success({ stats: await getStats(schoolId) })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async export(schoolId?: string): Promise<ApiResponse<{ backup: BackupPayload }>> {
    try {
      const backup: BackupPayload = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
      }

      for (const [key, tableName] of BACKUP_TABLES) {
        const { sql, params } = scopedSelect(tableName, schoolId)
        backup[key] = await ConnectionManager.query(sql, params)
      }

      await ConnectionManager.execute(
        'INSERT INTO BackupLog (id, fileName, backupType, fileSize, createdAt) VALUES (?, ?, ?, ?, ?)',
        [
          generateId(),
          `backup-${new Date().toISOString().split('T')[0]}.json`,
          'FULL',
          `${JSON.stringify(backup).length} bytes`,
          new Date().toISOString(),
        ]
      )

      return ApiClient.success({ backup })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async restore(backup: BackupPayload, schoolId?: string): Promise<ApiResponse<{ message: string; importResults: Record<string, number> }>> {
    try {
      if (!backup || typeof backup !== 'object') {
        return ApiClient.error('Backup data is required')
      }

      const validationError = validateBackupPayload(backup)
      if (validationError) {
        return ApiClient.error(validationError)
      }

      const importResults: Record<string, number> = {}
      const queries: Array<{ sql: string; params: unknown[] }> = []

      for (const [key, tableName] of BACKUP_TABLES) {
        const records = backup[key]
        if (!Array.isArray(records)) continue

        let count = 0
        for (const record of records) {
          if (!record || typeof record !== 'object' || !('id' in record)) continue
          if (schoolId && ['School', 'User', 'Teacher', 'Class', 'Student', 'Subject', 'Exam', 'GradingConfig'].includes(tableName)) {
            const recSchoolId = (record as Record<string, unknown>)['schoolId']
            if (tableName === 'School' && String((record as Record<string, unknown>)['id']) !== String(schoolId)) {
              continue
            }
            if (tableName !== 'School' && (!recSchoolId || String(recSchoolId) !== String(schoolId))) {
              continue
            }
          }
          queries.push(upsertStatement(tableName, record as Record<string, unknown>))
          count++
        }
        importResults[key] = count
      }

      if (queries.length > 0) {
        await ConnectionManager.transaction(queries)
      }

      return ApiClient.success({
        message: 'Backup imported successfully',
        importResults,
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },
}
