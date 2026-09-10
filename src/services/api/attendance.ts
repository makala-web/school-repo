import { ConnectionManager } from '@/services/database/ConnectionManager'
import { ApiClient, type ApiResponse } from './ApiClient'
import { generateId } from '@/modules/validation'

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'SICK' | 'PERMISSION'

export interface AttendanceStudent {
  id: string
  fullName: string
  admissionNo?: string | null
  gender?: string
  status: AttendanceStatus | null
}

export interface AttendanceListResponse {
  classId: string
  date: string
  students: AttendanceStudent[]
}

export interface AttendanceSaveInput {
  classId: string
  date: string
  records: Array<{ studentId: string; status: AttendanceStatus }>
}

export interface AttendanceReportRow {
  id: string
  fullName: string
  admissionNo?: string | null
  totalDays: number
  recordedDays: number
  present: number
  absent: number
  sick: number
  permission: number
  unmarked: number
}

export interface AttendanceReportResponse {
  classId: string
  fromDate: string
  toDate: string
  students: AttendanceReportRow[]
}

function periodDays(fromDate: string, toDate: string) {
  const from = Date.parse(`${fromDate}T00:00:00Z`)
  const to = Date.parse(`${toDate}T00:00:00Z`)
  return Number.isFinite(from) && Number.isFinite(to) && to >= from
    ? Math.floor((to - from) / 86400000) + 1
    : 0
}

async function listLocal(classId: string, date: string): Promise<AttendanceListResponse> {
  const rows = await ConnectionManager.query<Record<string, unknown>>(`
    SELECT s.id, s.fullName, s.admissionNo, s.gender, a.status
    FROM Student s
    LEFT JOIN Attendance a ON a.studentId = s.id AND a.classId = s.classId AND a.date = ?
    WHERE s.classId = ? AND s.status = 'ACTIVE'
    ORDER BY s.fullName ASC
  `, [date, classId])
  return {
    classId,
    date,
    students: rows.map(row => ({
      id: String(row.id),
      fullName: String(row.fullName || ''),
      admissionNo: row.admissionNo as string | null,
      gender: row.gender as string | undefined,
      status: row.status ? String(row.status) as AttendanceStatus : null,
    })),
  }
}

async function reportLocal(classId: string, fromDate: string, toDate: string): Promise<AttendanceReportResponse> {
  const totalDays = periodDays(fromDate, toDate)
  const rows = await ConnectionManager.query<Record<string, unknown>>(`
    SELECT s.id, s.fullName, s.admissionNo,
      COUNT(a.id) AS recordedDays,
      SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) AS absent,
      SUM(CASE WHEN a.status = 'SICK' THEN 1 ELSE 0 END) AS sick,
      SUM(CASE WHEN a.status = 'PERMISSION' THEN 1 ELSE 0 END) AS permission
    FROM Student s
    LEFT JOIN Attendance a ON a.studentId = s.id
      AND a.classId = ? AND a.date >= ? AND a.date <= ?
    WHERE s.classId = ? AND s.status = 'ACTIVE'
    GROUP BY s.id, s.fullName, s.admissionNo
    ORDER BY s.fullName ASC
  `, [classId, fromDate, toDate, classId])
  return {
    classId,
    fromDate,
    toDate,
    students: rows.map(row => {
      const present = Number(row.present || 0)
      const absent = Number(row.absent || 0)
      const sick = Number(row.sick || 0)
      const permission = Number(row.permission || 0)
      const recordedDays = Number(row.recordedDays || 0)
      return {
        id: String(row.id),
        fullName: String(row.fullName || ''),
        admissionNo: row.admissionNo as string | null,
        totalDays,
        recordedDays,
        present,
        absent,
        sick,
        permission,
        unmarked: Math.max(totalDays - recordedDays, 0),
      }
    }),
  }
}

export const AttendanceApi = {
  async list(params: { classId: string; date: string }): Promise<ApiResponse<AttendanceListResponse>> {
    try {
      const data = await listLocal(params.classId, params.date)
      return ApiClient.success(data)
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async report(params: { classId: string; fromDate: string; toDate: string }): Promise<ApiResponse<AttendanceReportResponse>> {
    try {
      if (!params.fromDate || !params.toDate || params.fromDate > params.toDate) {
        return ApiClient.error('Attendance report dates are invalid')
      }
      return ApiClient.success(await reportLocal(params.classId, params.fromDate, params.toDate))
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async save(input: AttendanceSaveInput): Promise<ApiResponse<{ saved: number }>> {
    try {
      const now = new Date().toISOString()
      await ConnectionManager.transaction(input.records.map(record => ({
        sql: `
          INSERT INTO Attendance (id, studentId, classId, date, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(studentId, classId, date) DO UPDATE SET status = excluded.status, updatedAt = excluded.updatedAt
        `,
        params: [generateId(), record.studentId, input.classId, input.date, record.status, now, now],
      })))
      return ApiClient.success({ saved: input.records.length }, 'Attendance saved locally')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },
}
