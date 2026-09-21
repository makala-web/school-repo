import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { useAppStore } from '@/lib/store'
import * as XLSX from 'xlsx'
import { PRIMARY_MASTER_SUBJECTS, SECONDARY_MASTER_SUBJECTS } from '@/lib/subject-catalogue'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Resize an image file to a reasonable size for logo storage
export function resizeImageFile(file: File, maxSize: number = 200, quality: number = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const img = document.createElement('img')
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Scale down to maxSize while maintaining aspect ratio
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width)
            width = maxSize
          } else {
            width = Math.round((width * maxSize) / height)
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
        }

        if (!ctx) {
          reject(new Error('Your browser could not prepare this image'))
          return
        }

        // Keep the database payload small even when the original upload is huge.
        let resized = canvas.toDataURL('image/jpeg', quality)
        for (const nextQuality of [0.7, 0.55, 0.4, 0.25]) {
          if (resized.length <= 650000) break
          resized = canvas.toDataURL('image/jpeg', nextQuality)
        }
        if (resized.length > 700000) {
          reject(new Error('Image could not be compressed below the storage limit'))
          return
        }
        resolve(resized)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// Grading utilities for Shulea App

// Primary School Grading (out of 50)
export const PRIMARY_GRADING = [
  { grade: 'A', min: 41, max: 50, remarks: 'Excellent' },
  { grade: 'B', min: 31, max: 40, remarks: 'Very Good' },
  { grade: 'C', min: 21, max: 30, remarks: 'Good' },
  { grade: 'D', min: 11, max: 20, remarks: 'Satisfactory' },
  { grade: 'E', min: 0, max: 10, remarks: 'Fail' },
]

// Secondary School Grading (out of 100)
export const SECONDARY_GRADING = [
  { grade: 'A', min: 75, max: 100, remarks: 'Excellent', points: 1 },
  { grade: 'B', min: 65, max: 74, remarks: 'Very Good', points: 2 },
  { grade: 'C', min: 45, max: 64, remarks: 'Good', points: 3 },
  { grade: 'D', min: 30, max: 44, remarks: 'Satisfactory', points: 4 },
  { grade: 'F', min: 0, max: 29, remarks: 'Fail', points: 5 },
]

// Secondary NECTA Division (based on best 7 subjects points)
export const NECTA_DIVISION = [
  { division: 'I', minPoints: 7, maxPoints: 17 },
  { division: 'II', minPoints: 18, maxPoints: 21 },
  { division: 'III', minPoints: 22, maxPoints: 25 },
  { division: 'IV', minPoints: 26, maxPoints: 33 },
  { division: '0', minPoints: 34, maxPoints: 999 },
]

export function getGrade(
  marks: number,
  schoolType: 'PRIMARY' | 'SECONDARY'
): { grade: string; remarks: string; points?: number } {
  const grading = schoolType === 'PRIMARY' ? PRIMARY_GRADING : SECONDARY_GRADING
  const entry = grading.find(g => marks >= g.min && marks <= g.max)
  return entry || { grade: '-', remarks: '-', points: 0 }
}

export function getDivision(totalPoints: number) {
  const entry = NECTA_DIVISION.find(d => totalPoints >= d.minPoints && totalPoints <= d.maxPoints)
  return entry?.division || '0'
}

// Auto signature generator
export function getAutoSignature(name: string | null | undefined, shortName: string | null | undefined, sign: string | null | undefined): string {
  if (sign) return sign
  if (shortName) return shortName
  if (!name) return '________________'
  // Auto-generate initials: e.g. "Juma Hamisi" → "J.Hamisi"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return parts[0].charAt(0).toUpperCase() + '.' + parts[parts.length - 1]
  }
  return name
}

// Backward-compatible exports. The catalogue itself lives in one source.
export const PRIMARY_SUBJECTS_2026 = PRIMARY_MASTER_SUBJECTS
export const SECONDARY_SUBJECTS_2026 = SECONDARY_MASTER_SUBJECTS

// Default subjects for backward compatibility
export const PRIMARY_SUBJECTS = PRIMARY_SUBJECTS_2026
export const SECONDARY_SUBJECTS = SECONDARY_SUBJECTS_2026

// API helper - supports both web (fetch) and mobile (direct API services)
import { ConnectionManager } from '@/services/database/ConnectionManager'
import { enqueueOfflineMutation } from '@/services/database/OfflineSyncQueue'
import { runAuthorizedSyncCycle } from '@/services/database/CloudSyncHydrator'
import { getUserFriendlyError } from '@/lib/user-friendly-errors'
import { StudentsApi, ClassesApi, SchoolApi, SubjectsApi, ExamsApi, MarksApi, AuthApi, UsersApi, TabiaApi, ResultsApi, SeedApi, SmsApi, BackupApi, AttendanceApi } from '@/services/api'
import { importStudentsFromCsv, importStudentsFromFile } from '@/services/api/students'
import { bulkSaveMarks, computeMarksResults } from '@/services/api/marks'

function newLocalId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function listLocalClassTeacherAssignments(params: Record<string, unknown>) {
  const currentUser = useAppStore.getState().currentUser
  const schoolId = String(params.schoolId || currentUser?.schoolId || '')
  const includeHistory = String(params.includeHistory || '') === 'true'
  if (!schoolId || currentUser?.schoolId !== schoolId || !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(currentUser?.role || '')) {
    throw new Error('School administrator access required')
  }

  let sql = `
    SELECT a.*,
      c.id AS class_id, c.name AS class_name, c.fullName AS class_fullName,
      t.id AS teacher_id, t.name AS teacher_name, t.shortName AS teacher_shortName, t.sign AS teacher_sign, t.phone AS teacher_phone, t.schoolId AS teacher_schoolId, t.userId AS teacher_userId,
      s.id AS school_id, s.name AS school_name, s.schoolType AS school_schoolType
    FROM ClassTeacherAssignment a
    JOIN Class c ON c.id = a.classId
    JOIN Teacher t ON t.id = a.teacherId
    JOIN School s ON s.id = a.schoolId
    WHERE a.schoolId = ?
  `
  const queryParams: unknown[] = [schoolId]
  if (params.classId) {
    sql += ' AND a.classId = ?'
    queryParams.push(String(params.classId))
  }
  if (params.academicYear) {
    sql += ' AND a.academicYear = ?'
    queryParams.push(String(params.academicYear))
  }
  if (!includeHistory) sql += " AND a.status = 'ACTIVE'"
  sql += ' ORDER BY c.name ASC'

  const rows = await ConnectionManager.query<Record<string, unknown>>(sql, queryParams)
  return {
    assignments: rows.map(row => ({
      id: String(row.id),
      schoolId: String(row.schoolId),
      classId: String(row.classId),
      teacherId: String(row.teacherId),
      academicYear: String(row.academicYear),
      startDate: String(row.startDate),
      endDate: row.endDate ? String(row.endDate) : null,
      status: String(row.status),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      class: { id: String(row.class_id), name: String(row.class_name), fullName: String(row.class_fullName) },
      teacher: {
        id: String(row.teacher_id),
        name: String(row.teacher_name),
        shortName: row.teacher_shortName ? String(row.teacher_shortName) : null,
        sign: row.teacher_sign ? String(row.teacher_sign) : null,
        phone: row.teacher_phone ? String(row.teacher_phone) : null,
        schoolId: String(row.teacher_schoolId),
        userId: row.teacher_userId ? String(row.teacher_userId) : null,
      },
      school: { id: String(row.school_id), name: String(row.school_name), schoolType: String(row.school_schoolType) },
    })),
    total: rows.length,
  }
}

async function assignLocalClassTeacher(params: Record<string, unknown>) {
  const currentUser = useAppStore.getState().currentUser
  const id = String(params.id || newLocalId())
  const schoolId = String(params.schoolId || currentUser?.schoolId || '')
  const classId = String(params.classId || '')
  const teacherId = String(params.teacherId || '')
  const academicYear = String(params.academicYear || new Date().getFullYear())
  const startDate = String(params.startDate || new Date().toISOString().slice(0, 10))
  if (!schoolId || currentUser?.schoolId !== schoolId || currentUser?.role !== 'SCHOOL_ADMIN') {
    throw new Error('School administrator access required')
  }
  if (!classId || !teacherId) throw new Error('Class and teacher are required')

  const [classRecord] = await ConnectionManager.query<{ schoolId: string; fullName: string }>('SELECT schoolId, fullName FROM Class WHERE id = ? LIMIT 1', [classId])
  const [teacher] = await ConnectionManager.query<{ schoolId: string; name: string }>('SELECT schoolId, name FROM Teacher WHERE id = ? LIMIT 1', [teacherId])
  if (!classRecord || classRecord.schoolId !== schoolId) throw new Error('Class not found or does not belong to school')
  if (!teacher || teacher.schoolId !== schoolId) throw new Error('Teacher not found or does not belong to school')

  const now = new Date().toISOString()
  const existing = await ConnectionManager.query<{ id: string; teacherId: string }>(
    "SELECT id, teacherId FROM ClassTeacherAssignment WHERE schoolId = ? AND classId = ? AND academicYear = ? AND status = 'ACTIVE' LIMIT 1",
    [schoolId, classId, academicYear],
  )
  if (existing[0]?.teacherId === teacherId) {
    return {
      message: 'This teacher is already assigned to the selected class for this academic year.',
      assignment: (await listLocalClassTeacherAssignments({ schoolId, classId, academicYear })).assignments[0],
      alreadyExists: true,
    }
  }

  await ConnectionManager.transaction([
    { sql: "UPDATE ClassTeacherAssignment SET status = 'INACTIVE', endDate = ?, updatedAt = ? WHERE schoolId = ? AND classId = ? AND academicYear = ? AND status = 'ACTIVE'", params: [now.slice(0, 10), now, schoolId, classId, academicYear] },
    { sql: 'INSERT INTO ClassTeacherAssignment (id, schoolId, classId, teacherId, academicYear, startDate, endDate, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', params: [id, schoolId, classId, teacherId, academicYear, startDate, null, 'ACTIVE', now, now] },
    { sql: 'UPDATE Class SET classTeacherId = ?, updatedAt = ? WHERE id = ? AND schoolId = ?', params: [teacherId, now, classId, schoolId] },
  ])

  const assignment = (await listLocalClassTeacherAssignments({ schoolId, classId, academicYear })).assignments.find((item: Record<string, unknown>) => item.id === id)
  return { message: 'Class teacher assigned successfully', assignment }
}

async function updateLocalClassTeacherAssignment(params: Record<string, unknown>) {
  const currentUser = useAppStore.getState().currentUser
  const assignmentId = String(params.assignmentId || '')
  if (!assignmentId || currentUser?.role !== 'SCHOOL_ADMIN' || !currentUser?.schoolId) throw new Error('School administrator access required')
  const [assignment] = await ConnectionManager.query<{ id: string; schoolId: string; classId: string; academicYear: string }>(
    'SELECT id, schoolId, classId, academicYear FROM ClassTeacherAssignment WHERE id = ? LIMIT 1',
    [assignmentId],
  )
  if (!assignment || assignment.schoolId !== currentUser.schoolId) throw new Error('Assignment not found')

  const now = new Date().toISOString()
  const updates: string[] = []
  const values: unknown[] = []
  if (params.teacherId !== undefined) {
    const [teacher] = await ConnectionManager.query<{ schoolId: string }>('SELECT schoolId FROM Teacher WHERE id = ? LIMIT 1', [String(params.teacherId)])
    if (!teacher || teacher.schoolId !== currentUser.schoolId) throw new Error('Teacher not found or does not belong to school')
    updates.push('teacherId = ?')
    values.push(String(params.teacherId))
  }
  if (params.status !== undefined) {
    updates.push('status = ?')
    values.push(String(params.status))
  }
  if (params.endDate !== undefined) {
    updates.push('endDate = ?')
    values.push(params.endDate ? String(params.endDate) : null)
  }
  if (!updates.length) throw new Error('No assignment changes provided')
  updates.push('updatedAt = ?')
  values.push(now, assignmentId)

  const queries: Array<{ sql: string; params?: unknown[] }> = []
  if (params.status === 'ACTIVE') {
    queries.push({ sql: "UPDATE ClassTeacherAssignment SET status = 'INACTIVE', endDate = ?, updatedAt = ? WHERE schoolId = ? AND classId = ? AND academicYear = ? AND status = 'ACTIVE' AND id <> ?", params: [now.slice(0, 10), now, assignment.schoolId, assignment.classId, assignment.academicYear, assignmentId] })
  }
  queries.push({ sql: `UPDATE ClassTeacherAssignment SET ${updates.join(', ')} WHERE id = ?`, params: values })
  if (params.teacherId !== undefined || params.status === 'ACTIVE') {
    queries.push({ sql: "UPDATE Class SET classTeacherId = (SELECT teacherId FROM ClassTeacherAssignment WHERE classId = ? AND schoolId = ? AND status = 'ACTIVE' ORDER BY updatedAt DESC LIMIT 1), updatedAt = ? WHERE id = ? AND schoolId = ?", params: [assignment.classId, assignment.schoolId, now, assignment.classId, assignment.schoolId] })
  }
  await ConnectionManager.transaction(queries)
  const [updated] = (await listLocalClassTeacherAssignments({ schoolId: assignment.schoolId, classId: assignment.classId, academicYear: assignment.academicYear, includeHistory: 'true' })).assignments.filter((item: Record<string, unknown>) => item.id === assignmentId)
  return { message: 'Assignment updated successfully', assignment: updated }
}

async function removeLocalClassTeacherAssignment(params: Record<string, unknown>) {
  const currentUser = useAppStore.getState().currentUser
  const assignmentId = String(params.assignmentId || '')
  if (!assignmentId || currentUser?.role !== 'SCHOOL_ADMIN' || !currentUser?.schoolId) throw new Error('School administrator access required')
  const [assignment] = await ConnectionManager.query<{ id: string; schoolId: string; classId: string }>(
    'SELECT id, schoolId, classId FROM ClassTeacherAssignment WHERE id = ? LIMIT 1',
    [assignmentId],
  )
  if (!assignment || assignment.schoolId !== currentUser.schoolId) throw new Error('Assignment not found')

  const now = new Date().toISOString()
  await ConnectionManager.transaction([
    { sql: "UPDATE ClassTeacherAssignment SET status = 'INACTIVE', endDate = ?, updatedAt = ? WHERE id = ?", params: [now.slice(0, 10), now, assignmentId] },
    { sql: "UPDATE Class SET classTeacherId = (SELECT teacherId FROM ClassTeacherAssignment WHERE classId = ? AND schoolId = ? AND status = 'ACTIVE' ORDER BY updatedAt DESC LIMIT 1), updatedAt = ? WHERE id = ? AND schoolId = ?", params: [assignment.classId, assignment.schoolId, now, assignment.classId, assignment.schoolId] },
  ])
  const [updated] = (await listLocalClassTeacherAssignments({ schoolId: assignment.schoolId, classId: assignment.classId, includeHistory: 'true' })).assignments.filter((item: Record<string, unknown>) => item.id === assignmentId)
  return { message: 'Assignment removed successfully', assignment: updated }
}

// Map endpoints to API services for mobile mode
const endpointMap: Record<string, (params: Record<string, unknown>, method?: string) => Promise<unknown>> = {
  // Auth
  '/api/shulea/auth': (params, method) => {
    if (method === 'POST') {
      const action = params.action as string
      switch (action) {
        case 'login':
          return AuthApi.login({ email: params.email as string, password: params.password as string })
        case 'register':
          return AuthApi.register({
            email: params.email as string,
            username: params.username as string,
            password: params.password as string,
            fullName: params.fullName as string,
            schoolType: params.schoolType as 'PRIMARY' | 'SECONDARY',
            securityQuestion: params.securityQuestion as string,
            securityAnswer: params.securityAnswer as string,
            schoolId: params.schoolId as string | undefined,
          })
        case 'change-password':
          return AuthApi.changePassword({
            userId: params.userId as string,
            currentPassword: params.currentPassword as string,
            newPassword: params.newPassword as string
          })
        case 'demo-login':
        case 'register-with-invitation':
          // These flows require the server session and must not be handled by the
          // offline repository adapter.
          return apiCallWeb('/api/shulea/auth', {
            method: 'POST',
            body: JSON.stringify(params),
          })
        default:
          throw new Error('Invalid auth action')
      }
    }
    // GET request - check users
    return AuthApi.checkUsers()
  },
  // Students
  '/api/shulea/students': (params, method) => {
    if (method === 'POST' && params.action === 'csv-upload') {
      return importStudentsFromCsv(params.csvData as string, params.classId as string, params.schoolId as string)
    }
    if (method === 'POST' && params.file instanceof File) {
      return importStudentsFromFile(params.file, params.classId as string, params.schoolId as string)
    }
    if (method === 'POST') return StudentsApi.create(params as unknown as Parameters<typeof StudentsApi.create>[0])
    if (method === 'PUT') return StudentsApi.update(params as unknown as Parameters<typeof StudentsApi.update>[0])
    if (method === 'DELETE') return StudentsApi.delete(params.id as string)
    if (params.id) return StudentsApi.getById(params.id as string)
    if (params.nextAdmissionNo) return StudentsApi.getNextAdmissionNo(params.nextAdmissionNo as string)
    return StudentsApi.list(params)
  },
  // Classes
  '/api/shulea/classes': (params, method) => {
    if (method === 'POST') return ClassesApi.create(params as unknown as Parameters<typeof ClassesApi.create>[0])
    if (method === 'PUT') return ClassesApi.update(params as unknown as Parameters<typeof ClassesApi.update>[0])
    if (method === 'DELETE') return ClassesApi.delete(params.id as string)
    if (params.id) return ClassesApi.getById(params.id as string)
    return ClassesApi.list(params)
  },
  // Teacher workspace reads. These local adapters keep an already-authenticated
  // teacher usable offline after the authorized device has been hydrated.
  '/api/shulea/teachers': async (params, method) => {
    if (method && method !== 'GET') throw new Error('Teacher administration requires an internet connection')
    const schoolId = String(params.schoolId || '')
    const teachers = await ConnectionManager.query<Record<string, unknown>>(
      'SELECT id, name, shortName, email, phone, userId, schoolId FROM Teacher WHERE schoolId = ? ORDER BY name ASC',
      [schoolId],
    )
    return { teachers }
  },
  '/api/shulea/teacher-classes': async (params, method) => {
    if (method && method !== 'GET') throw new Error('Teacher administration requires an internet connection')
    const teacherId = String(params.teacherId || '')
    const schoolId = String(params.schoolId || '')
    const classTeacherRows = await ConnectionManager.query<Record<string, unknown>>(
      `SELECT c.id, c.name, c.fullName, a.teacherId AS classTeacherId
       FROM ClassTeacherAssignment a
       JOIN Class c ON c.id = a.classId
       WHERE a.schoolId = ? AND a.teacherId = ? AND a.status = 'ACTIVE'
       ORDER BY c.name ASC`,
      [schoolId, teacherId],
    )
    const subjectRows = await ConnectionManager.query<Record<string, unknown>>(
      `SELECT c.id, c.name, c.fullName, ts.subjectId, s.name AS subjectName
       FROM TeacherSubject ts
       JOIN Class c ON c.id = ts.classId
       JOIN Subject s ON s.id = ts.subjectId
       WHERE ts.teacherId = ? AND c.schoolId = ? ORDER BY c.name ASC, s.name ASC`,
      [teacherId, schoolId],
    )
    const classTeacherAssignments = classTeacherRows.map(row => ({
      id: String(row.id), name: String(row.name), fullName: String(row.fullName),
      role: 'CLASS_TEACHER', subjects: subjectRows.filter(item => item.id === row.id).map(item => String(item.subjectName)),
    }))
    const subjectOnlyAssignments = subjectRows
      .filter(row => !classTeacherRows.some(item => item.id === row.id))
      .reduce<Array<Record<string, unknown>>>((items, row) => {
        const existing = items.find(item => item.id === row.id)
        if (existing) (existing.subjects as string[]).push(String(row.subjectName))
        else items.push({ id: String(row.id), name: String(row.name), fullName: String(row.fullName), role: 'SUBJECT_TEACHER', subject: String(row.subjectName), subjects: [String(row.subjectName)] })
        return items
      }, [])
    return {
      teacher: { id: teacherId, schoolId },
      classTeacherAssignments,
      subjectOnlyAssignments,
      totalClasses: classTeacherAssignments.length + subjectOnlyAssignments.length,
      isMultiClassTeacher: classTeacherAssignments.length > 1,
    }
  },
  '/api/shulea/teacher-students': async (params, method) => {
    if (method && method !== 'GET') throw new Error('Teacher administration requires an internet connection')
    const teacherId = String(params.teacherId || '')
    const schoolId = String(params.schoolId || '')
    const classRows = await ConnectionManager.query<{ id: string }>(
      `SELECT a.classId AS id FROM ClassTeacherAssignment a JOIN Class c ON c.id = a.classId WHERE a.schoolId = ? AND a.teacherId = ? AND a.status = 'ACTIVE'
       UNION SELECT ts.classId AS id FROM TeacherSubject ts JOIN Class c ON c.id = ts.classId WHERE ts.teacherId = ? AND c.schoolId = ?`,
      [schoolId, teacherId, teacherId, schoolId],
    )
    if (!classRows.length) return { students: [], totalCount: 0, authorizedClasses: [], isMultiClass: false }
    const placeholders = classRows.map(() => '?').join(', ')
    const students = await ConnectionManager.query<Record<string, unknown>>(
      `SELECT s.*, c.name AS className, c.fullName AS classFullName FROM Student s JOIN Class c ON c.id = s.classId WHERE s.schoolId = ? AND s.status = 'ACTIVE' AND s.classId IN (${placeholders}) ORDER BY c.name ASC, s.fullName ASC`,
      [schoolId, ...classRows.map(row => row.id)],
    )
    const authorizedClasses = await ConnectionManager.query<Record<string, unknown>>(
      `SELECT id, name, fullName FROM Class WHERE id IN (${placeholders}) ORDER BY name ASC`,
      classRows.map(row => row.id),
    )
    return { students, totalCount: students.length, authorizedClasses, isMultiClass: authorizedClasses.length > 1 }
  },
  // School
  '/api/shulea/school': async (params, method) => {
    if (method === 'POST' && params.id) {
      const updated = await SchoolApi.update(params as unknown as Parameters<typeof SchoolApi.update>[0])
      if (updated.success || updated.error !== 'School not found') return updated
      return SchoolApi.create(params as unknown as Parameters<typeof SchoolApi.create>[0])
    }
    if (method === 'POST') return SchoolApi.create(params as unknown as Parameters<typeof SchoolApi.create>[0])
    if (method === 'PUT') return SchoolApi.update(params as unknown as Parameters<typeof SchoolApi.update>[0])
    if (method === 'DELETE') return SchoolApi.delete(params.id as string)
    if ((params.includeClasses || params.includeTeachers) && params.schoolId) {
      const schoolRows = await ConnectionManager.query<Record<string, unknown>>('SELECT * FROM School WHERE id = ? LIMIT 1', [String(params.schoolId)])
      const school = schoolRows[0]
      if (!school) return { school: null, schools: [] }
      const [classes, teachers] = await Promise.all([
        params.includeClasses ? ConnectionManager.query<Record<string, unknown>>('SELECT * FROM Class WHERE schoolId = ? ORDER BY name ASC', [String(params.schoolId)]) : Promise.resolve([]),
        params.includeTeachers ? ConnectionManager.query<Record<string, unknown>>('SELECT * FROM Teacher WHERE schoolId = ? ORDER BY name ASC', [String(params.schoolId)]) : Promise.resolve([]),
      ])
      return { school: { ...school, classes, teachers }, schools: [{ ...school, classes, teachers }] }
    }
    if (params.id) return SchoolApi.getById(params.id as string)
    return SchoolApi.list()
  },
  '/api/shulea/class-teacher-assignments': async (params, method) => {
    if (method === 'POST') {
      if (params.action === 'assign') return assignLocalClassTeacher(params)
      if (params.action === 'update') return updateLocalClassTeacherAssignment(params)
      if (params.action === 'remove') return removeLocalClassTeacherAssignment(params)
      if (params.action === 'get-by-teacher') {
        const teacherId = String(params.teacherId || '')
        const schoolId = useAppStore.getState().currentUser?.schoolId || ''
        const rows = await listLocalClassTeacherAssignments({ schoolId, includeHistory: 'false', academicYear: params.academicYear })
        const assignments = rows.assignments.filter((item: Record<string, unknown>) => item.teacherId === teacherId)
        return { assignments, total: assignments.length }
      }
    }
    return listLocalClassTeacherAssignments(params)
  },
  // Subjects
  '/api/shulea/subjects': (params, method) => {
    if (params.action === 'class-subjects') {
      return ClassesApi.getSubjects(params.classId as string).then(response => {
        if (!response.success) return response
        return {
          success: true,
          data: {
            classSubjects: (response.data?.subjects || []).map(subject => ({
              id: subject.id,
              subjectId: subject.subjectId,
              classId: params.classId,
              subject: {
                id: subject.subjectId,
                name: subject.name,
                shortName: subject.shortName || null,
              },
            })),
          },
        }
      })
    }
    if (method === 'POST' && params.action === 'assign-to-class') {
      const classId = params.classId as string
      const subjectIds = Array.isArray(params.subjectIds)
        ? params.subjectIds as string[]
        : params.subjectId
          ? [params.subjectId as string]
          : []

      return ClassesApi.getSubjects(classId).then(async response => {
        if (!response.success) return response

        const existingIds = new Set((response.data?.subjects || []).map(subject => subject.subjectId))
        const requestedIds = new Set(subjectIds)

        for (const subjectId of existingIds) {
          if (!requestedIds.has(subjectId)) {
            await ClassesApi.removeSubject(classId, subjectId)
          }
        }

        for (const subjectId of requestedIds) {
          if (!existingIds.has(subjectId)) {
            await ClassesApi.assignSubject(classId, subjectId)
          }
        }

        return {
          success: true,
          data: {
            message: 'Subjects assigned successfully',
            added: [...requestedIds].filter(id => !existingIds.has(id)).length,
            removed: [...existingIds].filter(id => !requestedIds.has(id)).length,
          },
        }
      })
    }
    if (method === 'POST') return SubjectsApi.create(params as unknown as Parameters<typeof SubjectsApi.create>[0])
    if (method === 'PUT') return SubjectsApi.update(params as unknown as Parameters<typeof SubjectsApi.update>[0])
    if (method === 'DELETE') return SubjectsApi.delete(params.id as string)
    if (params.id) return SubjectsApi.getById(params.id as string)
    return SubjectsApi.list(params)
  },
  // Exams
  '/api/shulea/exams': (params, method) => {
    if (method === 'POST') return ExamsApi.create(params as unknown as Parameters<typeof ExamsApi.create>[0])
    if (method === 'PUT') return ExamsApi.update(params as unknown as Parameters<typeof ExamsApi.update>[0])
    if (method === 'DELETE') return ExamsApi.delete(params.id as string)
    if (params.id) return ExamsApi.getById(params.id as string)
    return ExamsApi.list(params)
  },
  // Marks
  '/api/shulea/marks': (params, method) => {
    if (method === 'POST' && params.action === 'bulk-save') {
      return bulkSaveMarks(
        params.classId as string,
        params.marks as Array<{ studentId: string; classSubjectId: string; examId: string; marks?: number | null }>
      )
    }
    if (method === 'POST' && params.action === 'compute-results') {
      return computeMarksResults(params.classId as string, params.examId as string)
    }
    if (method === 'POST') return MarksApi.create(params as unknown as Parameters<typeof MarksApi.create>[0])
    if (method === 'PUT') return MarksApi.update(params as unknown as Parameters<typeof MarksApi.update>[0])
    if (method === 'DELETE') return MarksApi.delete(params.id as string)
    if (params.id) return MarksApi.getById(params.id as string)
    if (params.classId && params.examId) {
      return MarksApi.entryData({
        classId: params.classId as string,
        examId: params.examId as string,
        subjectId: params.subjectId as string | undefined,
      })
    }
    return MarksApi.list(params)
  },
  '/api/shulea/attendance': (params, method) => {
    if (method === 'POST') {
      return AttendanceApi.save({
        classId: params.classId as string,
        date: params.date as string,
        records: (params.records || []) as Array<{ studentId: string; status: 'PRESENT' | 'ABSENT' | 'SICK' | 'PERMISSION' }>,
      })
    }
    if (params.action === 'report') {
      return AttendanceApi.report({
        classId: params.classId as string,
        fromDate: params.fromDate as string,
        toDate: params.toDate as string,
      })
    }
    return AttendanceApi.list({ classId: params.classId as string, date: params.date as string })
  },
  '/api/shulea/users': (params, method) => {
    if (method && method !== 'GET') {
      throw new Error('Users API only supports GET method')
    }
    return UsersApi.list({ schoolId: params.schoolId as string | undefined })
  },
  // Tabia
  '/api/shulea/tabia': async (params, method) => {
    if (method === 'POST' && params.action === 'bulk-save') {
      const records = (params.records || []) as Array<{
        studentId: string
        classId?: string
        examId?: string
        discipline?: string
        hygiene?: string
        hardWorking?: string
        cooperation?: string
        honesty?: string
        leadership?: string
        sports?: string
      }>
      return TabiaApi.bulkSave(
        (params.classId as string) || records[0]?.classId || '',
        (params.examId as string) || records[0]?.examId || '',
        records.map(({ classId: _classId, examId: _examId, ...record }) => record)
      )
    }
    if (method === 'POST') return TabiaApi.create(params as unknown as Parameters<typeof TabiaApi.create>[0])
    if (method === 'PUT') return TabiaApi.update(params as unknown as Parameters<typeof TabiaApi.update>[0])
    if (method === 'DELETE') return TabiaApi.delete(params.id as string)
    if (params.id) return TabiaApi.getById(params.id as string)
    const recordsResponse = await TabiaApi.list(params)
    if (!recordsResponse.success) return recordsResponse

    if (params.classId && params.examId) {
      const studentsResponse = await StudentsApi.list({
        classId: params.classId as string,
        status: 'ACTIVE',
      })
      if (!studentsResponse.success) return studentsResponse

      return {
        success: true,
        data: {
          tabia: recordsResponse.data?.records || [],
          students: studentsResponse.data?.students || [],
        },
      }
    }

    return recordsResponse
  },
  // Results
  '/api/shulea/results': (params, method) => {
    if (params.action === 'summary') {
      return ResultsApi.summary(params.examId as string, params.classId as string)
    }
    if (params.action === 'top-students') {
      return ResultsApi.topStudents(params.examId as string, params.classId as string | undefined, Number(params.limit || 10))
    }
    if (params.action === 'bottom-students') {
      return ResultsApi.bottomStudents(params.examId as string, params.classId as string | undefined, Number(params.limit || 10))
    }
    if (params.action === 'subject-analysis') {
      return ResultsApi.subjectAnalysis(params.examId as string, params.classId as string)
    }
    if (params.action === 'overall-results') {
      return ResultsApi.overallResults(params.examId as string, params.classId as string)
    }
    if (params.action === 'report-card') {
      return ResultsApi.reportCard(params.studentId as string, params.examId as string)
    }
    if (method === 'POST' && params.action === 'update-dates') {
      if (params.classId && !params.studentId) {
        return ResultsApi.updateDatesForClass(
          params.classId as string,
          params.examId as string,
          params.closingDate as string | undefined,
          params.openingDate as string | undefined
        )
      }
      return ResultsApi.updateDates(
        params.studentId as string,
        params.examId as string,
        params.closingDate as string | undefined,
        params.openingDate as string | undefined
      )
    }
    if (method === 'POST' && params.action === 'calculate-ranks') {
      return ResultsApi.calculateRanks(params.examId as string, params.classId as string)
    }
    if (method === 'POST') return ResultsApi.create(params as unknown as Parameters<typeof ResultsApi.create>[0])
    if (method === 'PUT') return ResultsApi.update(params as unknown as Parameters<typeof ResultsApi.update>[0])
    if (method === 'DELETE') return ResultsApi.delete(params.id as string)
    if (params.id) return ResultsApi.getById(params.id as string)
    return ResultsApi.list(params)
  },
  // Seed
  '/api/shulea/seed': (params, method) => {
    if (method === 'POST') return SeedApi.seedDefaults(params)
    throw new Error('Seed API only supports POST method')
  },
  '/api/shulea/sms': (params, method) => {
    if (method === 'POST') {
      return SmsApi.saveHistory(params as Parameters<typeof SmsApi.saveHistory>[0])
    }
    if (params.action === 'history') {
      return SmsApi.history({
        status: params.status as string | undefined,
        classId: params.classId as string | undefined,
        student: params.student as string | undefined,
        date: params.date as string | undefined,
      })
    }
    if (params.action === 'preview-student') {
      return SmsApi.previewStudent(params.examId as string, params.studentId as string)
    }
    if (params.action === 'preview-exam') {
      return SmsApi.previewExam(params.examId as string)
    }
    throw new Error('Invalid SMS action')
  },
  // Backup
  '/api/shulea/backup': (params, method) => {
    // Ensure backups are scoped to the current user's school when running in mobile/offline mode
    const currentUser = useAppStore.getState().currentUser
    const schoolId = (params.schoolId as string | undefined) || currentUser?.schoolId
    if (method === 'POST') return BackupApi.restore(params.backup as Record<string, unknown>, schoolId)
    if (params.action === 'stats') return BackupApi.stats(schoolId)
    return BackupApi.export(schoolId)
  },
  // Grading - uses SchoolApi
  '/api/shulea/grading': (params, method) => {
    if (method === 'GET') {
      return SchoolApi.getGradingConfigs(params.schoolId as string, params.schoolType as 'PRIMARY' | 'SECONDARY' | undefined)
    }
    if (method === 'POST') {
      if (!params.grade) {
        return SchoolApi.initGrading(params.schoolId as string, params.schoolType as 'PRIMARY' | 'SECONDARY')
      }
      return SchoolApi.createGradingConfig(params.schoolId as string, params as unknown as Parameters<typeof SchoolApi.createGradingConfig>[1])
    }
    if (method === 'PUT') {
      return SchoolApi.updateGradingConfig(params as unknown as Parameters<typeof SchoolApi.updateGradingConfig>[0])
    }
    throw new Error('Grading API only supports GET, POST and PUT methods')
  },
}

export async function apiCall(endpoint: string, options?: RequestInit) {
  const isBrowser = typeof window !== 'undefined'
  const isOfflineBrowser = isBrowser && 'navigator' in window && navigator.onLine === false
  const isMappedEndpoint = Boolean(endpointMap[new URL(endpoint, 'http://localhost').pathname])
  const isMobile = ConnectionManager.isMobile()
  const method = (options?.method || 'GET').toUpperCase()
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const isAuthStatusCheck = endpoint === '/api/shulea/auth' && method === 'GET'

  // Authentication must use the server whenever a connection is available.
  // The local SQLite adapter may not yet contain a newly provisioned account.
  let authAction: string | undefined
  if (endpoint === '/api/shulea/auth' && options?.method === 'POST' && typeof options.body === 'string') {
    try { authAction = JSON.parse(options.body).action as string } catch { authAction = undefined }
  }
  // Demo sessions are server-backed read-only previews. Keep the login and all
  // subsequent demo reads on the server instead of switching to an empty local DB.
  if (isBrowser && !isOfflineBrowser && (isAuthStatusCheck || authAction === 'login' || authAction === 'demo-login')) {
    ConnectionManager.setMode('prisma')
    return apiCallWeb(endpoint, options)
  }

  const currentUser = useAppStore.getState().currentUser
  const isDemoSession = Boolean(currentUser?.isDemoUser || useAppStore.getState().currentSchool?.isDemo)
  const isPlatformOwner = currentUser?.role === 'SUPER_ADMIN'
  if (isBrowser && !isOfflineBrowser && (isDemoSession || isPlatformOwner) && endpoint.startsWith('/api/')) {
    ConnectionManager.setMode('prisma')
    return apiCallWeb(endpoint, options)
  }
  
  if (isOfflineBrowser && isMappedEndpoint) {
    ConnectionManager.setMode('sqlite')
    const localOptions = await prepareOfflineOptions(endpoint, options)
    const result = await apiCallMobile(endpoint, localOptions)
    if (isMutation && currentUser?.id && currentUser.schoolId && typeof localOptions?.body === 'string') {
      await enqueueOfflineMutation({
        endpoint,
        method,
        body: localOptions.body,
        baseVersion: await getMutationBaseVersion(endpoint, localOptions.body),
        userId: currentUser.id,
        schoolId: currentUser.schoolId,
      })
    }
    return result
  }

  if (isMobile && !isBrowser) {
    ConnectionManager.setMode('sqlite')
    return apiCallMobile(endpoint, options)
  }

  if (isBrowser && !isOfflineBrowser && endpoint.startsWith('/api/')) {
    ConnectionManager.setMode('prisma')
    if (currentUser?.id && currentUser.schoolId) {
      await runAuthorizedSyncCycle({ userId: currentUser.id, schoolId: currentUser.schoolId })
    }
  }
  
  try {
    return await apiCallWeb(endpoint, options)
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error)
    const serverUnavailable = /HTTP 5\d{2}/.test(errorText) || errorText.includes('temporarily unavailable')
    const isLoginRequest = endpoint === '/api/shulea/auth' && ['login', 'demo-login'].includes(authAction || '')
    const offlineCapableRequest = Boolean(currentUser?.id && currentUser.schoolId) && !isLoginRequest
    const networkFailed = error instanceof TypeError || (isBrowser && navigator.onLine === false) || (serverUnavailable && offlineCapableRequest)
    if (isBrowser && networkFailed && isMappedEndpoint && offlineCapableRequest) {
      ConnectionManager.setMode('sqlite')
      const localOptions = await prepareOfflineOptions(endpoint, options)
      const result = await apiCallMobile(endpoint, localOptions)
      if (isMutation && currentUser?.id && currentUser.schoolId && typeof localOptions?.body === 'string') {
        await enqueueOfflineMutation({
          endpoint,
          method,
          body: localOptions.body,
          baseVersion: await getMutationBaseVersion(endpoint, localOptions.body),
          userId: currentUser.id,
          schoolId: currentUser.schoolId,
        })
      }
      return result
    }
    throw error
  }
}

async function getMutationBaseVersion(endpoint: string, body: string): Promise<number | undefined> {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (typeof parsed.baseVersion === 'number' && Number.isInteger(parsed.baseVersion) && parsed.baseVersion >= 0) return parsed.baseVersion
    const path = endpoint.split('?')[0]
    const entityMap: Record<string, string> = {
      '/api/shulea/students': 'STUDENT',
      '/api/shulea/classes': 'CLASS',
      '/api/shulea/subjects': 'SUBJECT',
      '/api/shulea/teachers': 'TEACHER',
      '/api/shulea/class-teacher-assignments': 'CLASS_TEACHER_ASSIGNMENT',
      '/api/shulea/exams': 'EXAM',
      '/api/shulea/marks': 'MARK',
      '/api/shulea/results': 'RESULT',
      '/api/shulea/attendance': 'ATTENDANCE',
      '/api/shulea/tabia': 'TABIA',
      '/api/shulea/grading': 'GRADING_CONFIG',
    }
    const entityType = entityMap[path]
    const entityId = parsed.assignmentId || parsed.id || parsed.studentId || parsed.teacherId || parsed.classId || parsed.subjectId || parsed.examId
    if (!entityType || typeof entityId !== 'string') return undefined
    const key = `sync-version-${entityType}:${entityId}`
    const rows = await ConnectionManager.query<{ value: string }>('SELECT value FROM AppSetting WHERE key = ? LIMIT 1', [key])
    const version = Number(rows[0]?.value)
    return Number.isInteger(version) && version >= 0 ? version : undefined
  } catch {
    return undefined
  }
}

async function prepareOfflineOptions(endpoint: string, options?: RequestInit): Promise<RequestInit | undefined> {
  if (typeof options?.body === 'string') {
    const path = new URL(endpoint, 'http://localhost').pathname
    if (path === '/api/shulea/class-teacher-assignments' && (options.method || 'GET').toUpperCase() === 'POST') {
      try {
        const body = JSON.parse(options.body) as Record<string, unknown>
        if (body.action === 'assign' && !body.id) {
          return { ...options, body: JSON.stringify({ ...body, id: newLocalId() }) }
        }
      } catch {
        return options
      }
    }
    return options
  }
  if (!(options?.body instanceof FormData) || endpoint !== '/api/shulea/students') return options
  const file = options.body.get('file')
  const classId = String(options.body.get('classId') || '')
  const schoolId = String(options.body.get('schoolId') || '')
  if (!(file instanceof File)) return options

  let csvData = ''
  if (/\.xlsx?$/i.test(file.name)) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    csvData = XLSX.utils.sheet_to_csv(sheet)
  } else {
    csvData = await file.text()
  }

  return {
    ...options,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'csv-upload', csvData, classId, schoolId }),
  }
}

async function apiCallWeb(endpoint: string, options?: RequestInit) {
  // Don't set Content-Type for FormData
  const isFormData = options?.body instanceof FormData
  
  const headers: Record<string, string> = {}
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }
  
  if (options?.headers && typeof options.headers === 'object' && !Array.isArray(options.headers)) {
    Object.assign(headers, options.headers as Record<string, string>)
  }
  
  const isApiEndpoint = endpoint.startsWith('/api/')
  const res = await fetch(endpoint, {
    ...options,
    headers,
    cache: isApiEndpoint ? 'no-store' : options?.cache,
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    if (error.code === 'DATABASE_UNAVAILABLE') {
      throw new Error('Cloud database is temporarily unavailable. Please try again shortly.')
    }
    // A reachable API returning 5xx is a server/runtime problem, not an
    // offline mutation. Keep this distinct so login failures do not tell the
    // user that their internet is unavailable or that data was queued locally.
    if (res.status >= 500) {
      throw new Error(`Server is temporarily unavailable (HTTP ${res.status}). Please try again shortly.`)
    }
    throw new Error(getUserFriendlyError(error.error || 'Request failed'))
  }
  
  return res.json()
}

async function apiCallMobile(endpoint: string, options?: RequestInit) {
  try {
    // Parse endpoint to extract base path and query params
    const url = new URL(endpoint, 'http://localhost')
    const basePath = url.pathname
    const params: Record<string, unknown> = {}
    
    // Extract query params
    url.searchParams.forEach((value, key) => {
      params[key] = value
    })
    
    // Extract body params for POST/PUT
    if (options?.body && typeof options.body === 'string') {
      try {
        const bodyParams = JSON.parse(options.body)
        Object.assign(params, bodyParams)
      } catch {
        // Ignore parse errors for non-JSON bodies
      }
    } else if (options?.body instanceof FormData) {
      options.body.forEach((value, key) => {
        params[key] = value
      })
    }
    
    // Get HTTP method
    const method = options?.method || 'GET'
    
    // Extract ID from URL for single resource endpoints
    const pathParts = basePath.split('/')
    const lastPart = pathParts[pathParts.length - 1]
    if (lastPart && !endpointMap[basePath]) {
      // Check if last part is an ID
      const parentPath = pathParts.slice(0, -1).join('/')
      if (endpointMap[parentPath]) {
        params.id = lastPart
        const apiFunc = endpointMap[parentPath]
        const result = await apiFunc(params, method)
        return unwrapResponse(result)
      }
    }
    
    // Find matching API function
    const apiFunc = endpointMap[basePath]
    if (apiFunc) {
      const result = await apiFunc(params, method)
      return unwrapResponse(result)
    }
    
    // Fallback to web mode if endpoint not mapped
    console.warn(`[apiCallMobile] Endpoint ${basePath} not mapped, falling back to web mode`)
    return apiCallWeb(endpoint, options)
  } catch (error) {
    throw new Error(getUserFriendlyError(error, 'This action could not be completed.'))
  }
}

function unwrapResponse(result: unknown): unknown {
  // Unwrap ApiResponse wrapper if present
  if (result && typeof result === 'object' && 'success' in result) {
    const response = result as { success: boolean; data?: unknown; error?: string }
    if (!response.success) {
      throw new Error(response.error || 'Request failed')
    }
    return response.data || result
  }
  return result
}

// ========== EXCEL UTILITIES ==========
// Using xlsx library for Excel parsing and generation

export interface ExcelMarkRow {
  sn: number
  studentName: string
  marks: number
  grade: string
}

/**
 * Parse Excel file and extract marks data
 * Expected columns: S/N | STUDENT NAME | MARKS | GRADE
 */
export async function parseExcelMarks(file: File): Promise<ExcelMarkRow[]> {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.csv') || fileName.endsWith('.txt') || fileName.endsWith('.tsv')) {
    const text = await file.text()
    return parseDelimitedMarks(text)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          reject(new Error('Failed to read file'))
          return
        }
        
        const workbook = XLSX.read(data, { type: 'binary' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as (string | number)[][]
        
        if (jsonData.length < 2) {
          reject(new Error('Excel file is empty or has no data rows'))
          return
        }
        
        resolve(parseMarkRows(jsonData))
      } catch (error) {
        reject(new Error(`Failed to parse Excel: ${(error as Error).message}`))
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsBinaryString(file)
  })
}

function parseDelimitedMarks(text: string): ExcelMarkRow[] {
  const cleanText = text.replace(/^\uFEFF/, '').trim()
  if (!cleanText) return []

  const lines = cleanText.split(/\r?\n/).filter(Boolean)
  const delimiter = detectMarkDelimiter(lines[0] || '')
  const rows = lines.map(line => parseDelimitedLine(line, delimiter))
  return parseMarkRows(rows)
}

function detectMarkDelimiter(firstLine: string): string {
  const tabCount = (firstLine.match(/\t/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t'
  if (semicolonCount > commaCount) return ';'
  return ','
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function parseMarkRows(rawRows: (string | number)[][]): ExcelMarkRow[] {
  let headerRowIndex = -1

  for (let i = 0; i < Math.min(rawRows.length, 8); i++) {
    const row = rawRows[i]
    if (!row || row.length < 2) continue

    const normalized = row.map(cell => String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
    const hasStudentHeader = normalized.some(cell => ['studentname', 'fullname', 'name', 'jina'].includes(cell))
    const hasMarksHeader = normalized.some(cell => ['marks', 'mark', 'alama'].includes(cell))
    const firstCell = String(row[0] || '').toLowerCase()

    if ((hasStudentHeader && hasMarksHeader) || firstCell.includes('s/n') || firstCell === 'sn') {
      headerRowIndex = i
      break
    }

    if (!Number.isNaN(parseFloat(firstCell)) && String(row[1] || '').trim()) {
      headerRowIndex = i - 1
      break
    }
  }

  const startRow = Math.max(headerRowIndex + 1, 0)
  const rows: ExcelMarkRow[] = []

  for (let i = startRow; i < rawRows.length; i++) {
    const row = rawRows[i]
    if (!row || row.length < 2) continue

    const sn = parseInt(String(row[0] || '0'), 10) || rows.length + 1
    const studentName = String(row[1] || '').trim()
    const marksValue = String(row[2] ?? '').trim()
    const marks = marksValue === '' ? 0 : Number(marksValue)
    const grade = String(row[3] || '').trim()

    if (studentName && Number.isFinite(marks)) {
      rows.push({ sn, studentName, marks, grade })
    }
  }

  return rows
}

/**
 * Generate Excel file from marks data
 * Columns: S/N | STUDENT NAME | MARKS | GRADE
 */
export function generateExcelMarks(
  data: Array<{ sn: number; studentName: string; marks: number; grade: string }>,
  options: { examName?: string; className?: string; subjectName?: string } = {}
): Blob {
  // Prepare worksheet data
  const wsData = [
    ['S/N', 'STUDENT NAME', 'MARKS', 'GRADE'],
    ...data.map(row => [row.sn, row.studentName, row.marks, row.grade])
  ]
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  
  // Set column widths
  ws['!cols'] = [
    { wch: 5 },   // S/N
    { wch: 30 },  // STUDENT NAME
    { wch: 10 },  // MARKS
    { wch: 10 },  // GRADE
  ]
  
  // Create workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Marks')
  
  // Generate filename
  const filename = options.subjectName 
    ? `${options.subjectName}_${options.className || 'Class'}_${options.examName || 'Exam'}`.replace(/[^a-zA-Z0-9_]/g, '_')
    : 'Marks_Export'
  
  // Generate binary
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/**
 * Download Excel file to browser or mobile device
 */
export async function downloadExcel(blob: Blob, filename: string): Promise<void> {
  // Web-only: use browser download
  fallbackBrowserDownload(blob, filename)
}

function fallbackBrowserDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'export'}.xlsx`
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000)
}

/**
 * Generate and download Excel from marks data (convenience function)
 */
export function exportMarksToExcel(
  data: Array<{ sn: number; studentName: string; marks: number; grade: string }>,
  filename: string,
  options?: { examName?: string; className?: string; subjectName?: string }
): void {
  const wsData = [
    ['S/N', 'STUDENT NAME', 'MARKS', 'GRADE'],
    ...data.map(row => [row.sn, row.studentName, row.marks, row.grade])
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [
    { wch: 5 },
    { wch: 30 },
    { wch: 10 },
    { wch: 10 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Marks')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadExcel(blob, filename)
}

/**
 * Match Excel rows with students by name
 * Returns matched and unmatched rows
 */
export function matchExcelWithStudents(
  excelRows: ExcelMarkRow[],
  students: Array<{ id: string; fullName: string; admissionNo?: string | null }>
): {
  matched: Array<ExcelMarkRow & { studentId: string; matchedName: string }>
  unmatched: ExcelMarkRow[]
} {
  const matched: Array<ExcelMarkRow & { studentId: string; matchedName: string }> = []
  const unmatched: ExcelMarkRow[] = []
  
  const normalizeName = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim()

  for (const row of excelRows) {
    const normalizedExcelName = normalizeName(row.studentName)
    
    // Try exact match first
    let student = students.find(s => 
      normalizeName(s.fullName) === normalizedExcelName ||
      (s.admissionNo ? normalizeName(s.admissionNo) === normalizedExcelName : false)
    )
    
    // Try partial match if no exact match
    if (!student) {
      student = students.find(s => {
        const normalizedStudentName = normalizeName(s.fullName)
        return normalizedStudentName.includes(normalizedExcelName) || 
               normalizedExcelName.includes(normalizedStudentName)
      })
    }
    
    if (student) {
      matched.push({
        ...row,
        studentId: student.id,
        matchedName: student.fullName,
      })
    } else {
      unmatched.push(row)
    }
  }
  
  return { matched, unmatched }
}
