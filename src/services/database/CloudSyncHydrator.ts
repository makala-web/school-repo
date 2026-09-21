import { ConnectionManager } from './ConnectionManager'
import { SchemaManager } from './SchemaManager'
import { flushOfflineMutations } from './OfflineSyncQueue'
import { getActiveDataScope } from '@/lib/store'

type RecordValue = Record<string, unknown>

const TABLE_FIELDS: Record<string, string[]> = {
  School: ['id', 'name', 'schoolType', 'logo', 'logo2', 'registrationNo', 'council', 'region', 'district', 'ward', 'phone', 'email', 'headTeacherName', 'headTeacherSign', 'headTeacherComments', 'classTeacherName', 'classTeacherShortName', 'classTeacherComments', 'ctGradeA_en', 'ctGradeB_en', 'ctGradeC_en', 'ctGradeD_en', 'ctGradeE_en', 'ctGradeA_sw', 'ctGradeB_sw', 'ctGradeC_sw', 'ctGradeD_sw', 'ctGradeE_sw', 'htGradeA_en', 'htGradeB_en', 'htGradeC_en', 'htGradeD_en', 'htGradeE_en', 'htGradeA_sw', 'htGradeB_sw', 'htGradeC_sw', 'htGradeD_sw', 'htGradeE_sw', 'lastValidatedAt', 'renewalRequestedAt', 'renewalRequestedBy', 'academicYear', 'term', 'isDemo', 'licenseType', 'licenseStatus', 'activationCode', 'startDate', 'expiryDate', 'maxTeachers', 'maxDevices', 'maxStudents', 'createdAt', 'updatedAt'],
  Class: ['id', 'name', 'stream', 'fullName', 'schoolType', 'classTeacherId', 'schoolId', 'academicYear', 'term', 'createdAt', 'updatedAt'],
  ClassTeacherAssignment: ['id', 'schoolId', 'classId', 'teacherId', 'academicYear', 'startDate', 'endDate', 'status', 'createdAt', 'updatedAt'],
  Subject: ['id', 'name', 'shortName', 'schoolType', 'schoolId', 'createdAt', 'updatedAt'],
  Teacher: ['id', 'name', 'shortName', 'sign', 'phone', 'schoolId', 'userId', 'createdAt', 'updatedAt'],
  Student: ['id', 'admissionNo', 'fullName', 'gender', 'dob', 'parentName', 'parentPhone', 'status', 'classId', 'schoolId', 'createdAt', 'updatedAt'],
  ClassSubject: ['id', 'classId', 'subjectId', 'createdAt'],
  TeacherSubject: ['id', 'teacherId', 'subjectId', 'classId', 'createdAt'],
  Exam: ['id', 'name', 'examType', 'classId', 'schoolId', 'academicYear', 'term', 'examDate', 'createdAt', 'updatedAt'],
  Attendance: ['id', 'studentId', 'classId', 'date', 'status', 'createdAt', 'updatedAt'],
  MarksEntry: ['id', 'studentId', 'classSubjectId', 'examId', 'marks', 'grade', 'remarks', 'createdAt', 'updatedAt'],
  StudentResult: ['id', 'studentId', 'examId', 'classId', 'totalMarks', 'averageMarks', 'grade', 'division', 'points', 'rank', 'status', 'subjectCount', 'classTeacherComment', 'headTeacherComment', 'closingDate', 'openingDate', 'classTeacherSign', 'headTeacherSign', 'createdAt', 'updatedAt'],
  Tabia: ['id', 'studentId', 'classId', 'examId', 'discipline', 'hygiene', 'hardWorking', 'cooperation', 'honesty', 'leadership', 'sports', 'createdAt', 'updatedAt'],
  GradingConfig: ['id', 'schoolType', 'grade', 'minMark', 'maxMark', 'remarks', 'points', 'division', 'schoolId', 'createdAt', 'updatedAt'],
}

const LOCAL_SCOPE_KEY = 'offline-local-scope'

export async function ensureAuthorizedLocalScope() {
  const scope = getActiveDataScope()
  if (!scope.userId || !scope.schoolId) return

  const current = await ConnectionManager.query<{ value: string }>(
    'SELECT value FROM AppSetting WHERE key = ? LIMIT 1',
    [LOCAL_SCOPE_KEY],
  )
  const expected = `${scope.userId}:${scope.schoolId}`
  if (current[0]?.value === expected) return

  await SchemaManager.reset()
  await SchemaManager.initialize()
  await ConnectionManager.execute(
    'INSERT INTO AppSetting (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [LOCAL_SCOPE_KEY, LOCAL_SCOPE_KEY, expected],
  )
}

function sqlValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 1 : 0
  return value ?? null
}

function safeUpsert(table: string, record: RecordValue) {
  const fields = TABLE_FIELDS[table]
  if (!fields || typeof record.id !== 'string' || !record.id) {
    throw new Error(`Cannot hydrate ${table} without a stable record ID`)
  }

  // Older bootstrap payloads did not include timestamps for every entity.
  // Local SQLite keeps these columns NOT NULL, so preserve a valid server
  // value when present and provide a device-side fallback for legacy rows.
  const normalizedRecord: RecordValue = { ...record }
  const now = new Date().toISOString()
  if (fields.includes('createdAt') && !normalizedRecord.createdAt) normalizedRecord.createdAt = now
  if (fields.includes('updatedAt') && !normalizedRecord.updatedAt) normalizedRecord.updatedAt = normalizedRecord.createdAt || now
  if (table === 'School' && normalizedRecord.isDemo === undefined) normalizedRecord.isDemo = 0

  // UPDATE preserves the existing row and all foreign-key relationships.
  // The INSERT uses a NOT EXISTS guard so repeated hydration remains
  // idempotent without SQLite's destructive INSERT OR REPLACE behavior.
  const presentFields = fields.filter(field => field !== 'id' && normalizedRecord[field] !== undefined)
  const queries: Array<{ sql: string; params?: unknown[] }> = []
  if (presentFields.length) {
    queries.push({
      sql: `UPDATE ${table} SET ${presentFields.map(field => `${field} = ?`).join(', ')} WHERE id = ?`,
      params: [...presentFields.map(field => sqlValue(normalizedRecord[field])), record.id],
    })
  }

  const columns = fields.join(', ')
  const placeholders = fields.map(() => '?').join(', ')
  queries.push({
    sql: `INSERT INTO ${table} (${columns}) SELECT ${placeholders} WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE id = ?)`,
    params: [...fields.map(field => sqlValue(normalizedRecord[field])), record.id],
  })
  return queries
}

export async function hydrateAuthorizedDevice() {
  if (typeof window === 'undefined' || navigator.onLine === false) return { hydrated: false, reason: 'offline' }
  // Hydration is a browser-local operation. API calls may have switched the
  // shared manager to Prisma mode before this function runs.
  ConnectionManager.setMode('sqlite')
  await ConnectionManager.getSQLite()
  await SchemaManager.initialize()
  await ensureAuthorizedLocalScope()
  const response = await fetch('/api/sync/bootstrap', { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw new Error(`Initial synchronization failed (${response.status})`)
  const data = await response.json() as RecordValue & { classes?: RecordValue[]; subjects?: RecordValue[]; teachers?: RecordValue[]; students?: RecordValue[]; exams?: RecordValue[]; attendance?: RecordValue[]; marks?: RecordValue[]; results?: RecordValue[]; tabia?: RecordValue[]; gradingConfigs?: RecordValue[]; teacherSubjects?: RecordValue[]; assignments?: RecordValue[]; versions?: Array<{ entityType: string; entityId: string; version: number }>; cursor?: number }
  const queries: Array<{ sql: string; params?: unknown[] }> = []
  if (data.school) queries.push(...safeUpsert('School', data.school as RecordValue))
  for (const [table, records] of Object.entries({
    Class: data.classes,
    Subject: data.subjects,
    Teacher: data.teachers,
    Student: data.students,
    Exam: data.exams,
    Attendance: data.attendance,
    MarksEntry: data.marks,
    StudentResult: data.results,
    Tabia: data.tabia,
    GradingConfig: data.gradingConfigs,
    TeacherSubject: data.teacherSubjects,
    ClassTeacherAssignment: data.assignments,
  })) {
    for (const record of records || []) queries.push(...safeUpsert(table, record))
  }
  for (const item of data.classes || []) {
    for (const relation of (item.subjects as RecordValue[] | undefined) || []) {
      if (relation.subjectId) queries.push(...safeUpsert('ClassSubject', { id: relation.id, classId: item.id, subjectId: relation.subjectId, createdAt: relation.createdAt }))
    }
  }
  for (const version of data.versions || []) {
    if (Number.isInteger(version.version) && version.version >= 0) {
      const key = `sync-version-${version.entityType}:${version.entityId}`
      queries.push({ sql: 'INSERT INTO AppSetting (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', params: [key, key, String(version.version)] })
    }
  }
  queries.push({ sql: 'INSERT INTO AppSetting (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', params: [`sync-cursor-${String((data.school as RecordValue)?.id || '')}`, `sync-cursor-${String((data.school as RecordValue)?.id || '')}`, String(data.cursor || 0)] })
  if (queries.length) await ConnectionManager.transaction(queries)
  return { hydrated: true, cursor: Number(data.cursor || 0), counts: { classes: data.classes?.length || 0, students: data.students?.length || 0, exams: data.exams?.length || 0 } }
}

const ENTITY_TABLE: Record<string, string> = {
  STUDENT: 'Student', TEACHER: 'Teacher', CLASS: 'Class', SUBJECT: 'Subject',
  CLASS_SUBJECT: 'ClassSubject', TEACHER_SUBJECT: 'TeacherSubject', GRADING_CONFIG: 'GradingConfig',
  CLASS_TEACHER_ASSIGNMENT: 'ClassTeacherAssignment',
  ATTENDANCE: 'Attendance', EXAM: 'Exam', MARK: 'MarksEntry', RESULT: 'StudentResult', TABIA: 'Tabia',
}

let activeSyncCycle: Promise<{ synced: number; pulled: number }> | null = null

export async function runAuthorizedSyncCycle(scope: { userId?: string | null; schoolId?: string | null }) {
  if (!scope.userId || !scope.schoolId) return { synced: 0, pulled: 0 }
  if (activeSyncCycle) return activeSyncCycle

  activeSyncCycle = (async () => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      await flushOfflineMutations({ userId: scope.userId, schoolId: scope.schoolId })
      await pullAuthorizedChanges()
      return { synced: 1, pulled: 1 }
    }
    return { synced: 0, pulled: 0 }
  })().finally(() => {
    activeSyncCycle = null
  })

  return activeSyncCycle
}

export async function pullAuthorizedChanges() {
  if (typeof window === 'undefined' || navigator.onLine === false) return { pulled: 0 }
  // Pull writes the response into the device database, never into Prisma.
  ConnectionManager.setMode('sqlite')
  await ConnectionManager.getSQLite()
  await SchemaManager.initialize()
  await ensureAuthorizedLocalScope()
  const activeSchoolId = getActiveDataScope().schoolId
  if (!activeSchoolId) return { pulled: 0 }
  const schoolRows = await ConnectionManager.query<{ key: string; value: string }>(
    'SELECT key, value FROM AppSetting WHERE key = ? LIMIT 1',
    [`sync-cursor-${activeSchoolId}`],
  )
  const cursor = Number(schoolRows[0]?.value || 0)
  const cursorKey = schoolRows[0]?.key || 'sync-cursor-current'
  const response = await fetch(`/api/sync/pull?cursor=${cursor}&limit=100`, { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw new Error(`Incremental synchronization failed (${response.status})`)
  let data = await response.json() as { changes?: Array<{ entityType: string; entityId: string; action: string; version?: number; payload?: RecordValue | null }>; nextCursor?: number; authorizedClassIds?: string[] | null; hasMore?: boolean }
  const userId = getActiveDataScope().userId
  const classScopeKey = `authorized-classes-${userId || 'unknown'}`
  const previousScope = await ConnectionManager.query<{ value: string }>('SELECT value FROM AppSetting WHERE key = ? LIMIT 1', [classScopeKey])
  const currentScope = data.authorizedClassIds ? [...data.authorizedClassIds].sort().join(',') : null
  if (currentScope !== null && previousScope[0]?.value !== currentScope) {
    const replay = await fetch('/api/sync/pull?cursor=0&limit=250&resync=1', { credentials: 'same-origin', cache: 'no-store' })
    if (!replay.ok) throw new Error(`Permission synchronization failed (${replay.status})`)
    data = await replay.json() as typeof data
  }
  const queries: Array<{ sql: string; params?: unknown[] }> = []
  for (const change of data.changes || []) {
    const table = ENTITY_TABLE[change.entityType]
    if (!table) continue
    if (change.action === 'DELETE') {
      queries.push({ sql: `DELETE FROM ${table} WHERE id = ?`, params: [change.entityId] })
      const versionKey = `sync-version-${change.entityType}:${change.entityId}`
      queries.push({ sql: 'DELETE FROM AppSetting WHERE key = ?', params: [versionKey] })
      continue
    }
    if (Number.isInteger(change.version) && (change.version as number) >= 0) {
      const versionKey = `sync-version-${change.entityType}:${change.entityId}`
      queries.push({ sql: 'INSERT INTO AppSetting (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', params: [versionKey, versionKey, String(change.version)] })
    }
    const payload = { ...(change.payload || {}), id: change.entityId }
    const fields = TABLE_FIELDS[table]
    if (!fields) continue
    const presentFields = fields.filter(field => field !== 'id' && payload[field] !== undefined)
    if (!presentFields.length) continue
    const existing = await ConnectionManager.query<{ id: string }>(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [change.entityId])
    if (existing.length) {
      queries.push({ sql: `UPDATE ${table} SET ${presentFields.map(field => `${field} = ?`).join(', ')} WHERE id = ?`, params: [...presentFields.map(field => sqlValue(payload[field])), change.entityId] })
    } else if (fields.every(field => field === 'id' || payload[field] !== undefined)) {
      queries.push(...safeUpsert(table, payload))
    }
  }
  const nextCursor = Number(data.nextCursor ?? cursor)
  if (currentScope !== null && previousScope[0]?.value && previousScope[0].value !== currentScope) {
    const previousClassIds = previousScope[0].value.split(',').filter(Boolean)
    const activeClassIds = new Set(currentScope.split(',').filter(Boolean))
    const removedClassIds = previousClassIds.filter(classId => !activeClassIds.has(classId))
    if (removedClassIds.length) {
      const placeholders = removedClassIds.map(() => '?').join(', ')
      queries.push(
        { sql: `DELETE FROM MarksEntry WHERE studentId IN (SELECT id FROM Student WHERE classId IN (${placeholders})) OR classSubjectId IN (SELECT id FROM ClassSubject WHERE classId IN (${placeholders})) OR examId IN (SELECT id FROM Exam WHERE classId IN (${placeholders}))`, params: [...removedClassIds, ...removedClassIds, ...removedClassIds] },
        { sql: `DELETE FROM Attendance WHERE classId IN (${placeholders})`, params: removedClassIds },
        { sql: `DELETE FROM Tabia WHERE classId IN (${placeholders})`, params: removedClassIds },
        { sql: `DELETE FROM StudentResult WHERE classId IN (${placeholders})`, params: removedClassIds },
        { sql: `DELETE FROM Student WHERE classId IN (${placeholders})`, params: removedClassIds },
        { sql: `DELETE FROM TeacherSubject WHERE classId IN (${placeholders})`, params: removedClassIds },
        { sql: `DELETE FROM ClassSubject WHERE classId IN (${placeholders})`, params: removedClassIds },
        { sql: `DELETE FROM Exam WHERE classId IN (${placeholders})`, params: removedClassIds },
        { sql: `DELETE FROM ClassTeacherAssignment WHERE classId IN (${placeholders})`, params: removedClassIds },
        { sql: `DELETE FROM Class WHERE id IN (${placeholders})`, params: removedClassIds },
      )
    }
  }
  queries.push({ sql: 'INSERT INTO AppSetting (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', params: [cursorKey, cursorKey, String(nextCursor)] })
  if (currentScope !== null) {
    queries.push({ sql: 'INSERT INTO AppSetting (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', params: [classScopeKey, classScopeKey, currentScope] })
  }
  if (queries.length) await ConnectionManager.transaction(queries)
  return { pulled: data.changes?.length || 0, cursor: nextCursor }
}
