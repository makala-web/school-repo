import { SmsResultsService, type SmsMessagePreview } from '@/services/sms/SmsResultsService'
import { ApiClient, type ApiResponse } from './ApiClient'
import { ConnectionManager } from '@/services/database/ConnectionManager'

export interface SmsHistoryInput {
  recipient?: string
  phone?: string
  studentId?: string | null
  studentName?: string
  classId?: string | null
  message?: string
  status?: string
  sentAt?: string
}

export interface SmsHistoryFilters {
  status?: string
  classId?: string
  student?: string
  date?: string
}

export const SmsApi = {
  async previewStudent(examId: string, studentId: string): Promise<ApiResponse<{ preview: SmsMessagePreview }>> {
    try {
      const preview = await SmsResultsService.prepareForStudent(examId, studentId)
      return ApiClient.success({ preview })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async previewExam(examId: string): Promise<ApiResponse<{ previews: SmsMessagePreview[] }>> {
    try {
      const previews = await SmsResultsService.prepareForExam(examId)
      return ApiClient.success({ previews })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async history(filters: SmsHistoryFilters = {}): Promise<ApiResponse<{ history: unknown[] }>> {
    try {
      const where: string[] = []
      const params: unknown[] = []

      if (filters.status && filters.status !== 'ALL') {
        where.push('status = ?')
        params.push(filters.status)
      }
      if (filters.classId && filters.classId !== 'ALL') {
        where.push('classId = ?')
        params.push(filters.classId)
      }
      if (filters.student) {
        where.push('(studentName LIKE ? OR studentId = ?)')
        params.push(`%${filters.student}%`, filters.student)
      }
      if (filters.date) {
        where.push('substr(sentAt, 1, 10) = ?')
        params.push(filters.date)
      }

      const history = await ConnectionManager.query(
        `SELECT * FROM SmsHistory ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY sentAt DESC LIMIT 500`,
        params
      )
      return ApiClient.success({ history })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async saveHistory(input: SmsHistoryInput | { items: SmsHistoryInput[] }): Promise<ApiResponse<{ saved: number }>> {
    try {
      const items = Array.isArray((input as { items?: SmsHistoryInput[] }).items)
        ? (input as { items: SmsHistoryInput[] }).items
        : [input as SmsHistoryInput]
      const now = new Date().toISOString()

      for (const item of items) {
        await ConnectionManager.execute(
          `INSERT INTO SmsHistory (id, recipient, studentId, studentName, classId, message, status, sentAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            String(item.recipient || item.phone || ''),
            item.studentId || null,
            String(item.studentName || 'Unknown Student'),
            item.classId || null,
            String(item.message || ''),
            String(item.status || 'SENT').toUpperCase(),
            item.sentAt || now,
            now,
          ]
        )
      }

      return ApiClient.success({ saved: items.length }, 'SMS history saved')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },
}
