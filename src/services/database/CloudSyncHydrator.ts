import { ConnectionManager } from './ConnectionManager'
import { SchemaManager } from './SchemaManager'

type RecordValue = Record<string, unknown>

const TABLE_FIELDS: Record<string, string[]> = {
  School: ['id', 'name', 'schoolType', 'logo', 'logo2', 'registrationNo', 'council', 'region', 'district', 'ward', 'phone', 'email', 'headTeacherName', 'headTeacherSign', 'headTeacherComments', 'classTeacherName', 'classTeacherShortName', 'classTeacherComments', 'ctGradeA_en', 'ctGradeB_en', 'ctGradeC_en', 'ctGradeD_en', 'ctGradeE_en', 'ctGradeA_sw', 'ctGradeB_sw', 'ctGradeC_sw', 'ctGradeD_sw', 'ctGradeE_sw', 'htGradeA_en', 'htGradeB_en', 'htGradeC_en', 'htGradeD_en', 'htGradeE_en', 'htGradeA_sw', 'htGradeB_sw', 'htGradeC_sw', 'htGradeD_sw', 'htGradeE_sw', 'lastValidatedAt', 'renewalRequestedAt', 'renewalRequestedBy', 'academicYear', 'term', 'isDemo', 'licenseType', 'licenseStatus', 'activationCode', 'startDate', 'expiryDate', 'maxTeachers', 'maxDevices', 'maxStudents', 'createdAt', 'updatedAt'],
  Class: ['id', 'name', 'stream', 'fullName', 'schoolType', 'classTeacherId', 'schoolId', 'academicYear', 'term', 'createdAt', 'updatedAt'],
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
  const response = await fetch('/api/sync/bootstrap', { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw new Error(`Initial synchronization failed (${response.status})`)
  const data = await response.json() as RecordValue & { classes?: RecordValue[]; subjects?: RecordValue[]; teachers?: RecordValue[]; students?: RecordValue[]; exams?: RecordValue[]; attendance?: RecordValue[]; marks?: RecordValue[]; results?: RecordValue[]; tabia?: RecordValue[]; gradingConfigs?: RecordValue[]; teacherSubjects?: RecordValue[]; cursor?: number }
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
  })) {
    for (const record of records || []) queries.push(...safeUpsert(table, record))
  }
  for (const item of data.classes || []) {
    for (const relation of (item.subjects as RecordValue[] | undefined) || []) {
      if (relation.subjectId) queries.push(...safeUpsert('ClassSubject', { id: relation.id, classId: item.id, subjectId: relation.subjectId, createdAt: relation.createdAt }))
    }
  }
  queries.push({ sql: 'INSERT INTO AppSetting (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', params: [`sync-cursor-${String((data.school as RecordValue)?.id || '')}`, `sync-cursor-${String((data.school as RecordValue)?.id || '')}`, String(data.cursor || 0)] })
  if (queries.length) await ConnectionManager.transaction(queries)
  return { hydrated: true, cursor: Number(data.cursor || 0), counts: { classes: data.classes?.length || 0, students: data.students?.length || 0, exams: data.exams?.length || 0 } }
}

const ENTITY_TABLE: Record<string, string> = {
  STUDENT: 'Student', TEACHER: 'Teacher', CLASS: 'Class', SUBJECT: 'Subject',
  CLASS_SUBJECT: 'ClassSubject', TEACHER_SUBJECT: 'TeacherSubject', GRADING_CONFIG: 'GradingConfig',
  ATTENDANCE: 'Attendance', EXAM: 'Exam', MARK: 'MarksEntry', RESULT: 'StudentResult', TABIA: 'Tabia',
}

export async function pullAuthorizedChanges() {
  if (typeof window === 'undefined' || navigator.onLine === false) return { pulled: 0 }
  // Pull writes the response into the device database, never into Prisma.
  ConnectionManager.setMode('sqlite')
  await ConnectionManager.getSQLite()
  await SchemaManager.initialize()
  const schoolRows = await ConnectionManager.query<{ key: string; value: string }>(`SELECT key, value FROM AppSetting WHERE key LIKE 'sync-cursor-%' ORDER BY key DESC LIMIT 1`)
  const cursor = Number(schoolRows[0]?.value || 0)
  const cursorKey = schoolRows[0]?.key || 'sync-cursor-current'
  const response = await fetch(`/api/sync/pull?cursor=${cursor}&limit=100`, { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw new Error(`Incremental synchronization failed (${response.status})`)
  const data = await response.json() as { changes?: Array<{ entityType: string; entityId: string; action: string; payload?: RecordValue | null }>; nextCursor?: number }
  const queries: Array<{ sql: string; params?: unknown[] }> = []
  for (const change of data.changes || []) {
    const table = ENTITY_TABLE[change.entityType]
    if (!table) continue
    if (change.action === 'DELETE') {
      queries.push({ sql: `DELETE FROM ${table} WHERE id = ?`, params: [change.entityId] })
      continue
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
  queries.push({ sql: 'INSERT INTO AppSetting (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', params: [cursorKey, cursorKey, String(nextCursor)] })
  if (queries.length) await ConnectionManager.transaction(queries)
  return { pulled: data.changes?.length || 0, cursor: nextCursor }
}
