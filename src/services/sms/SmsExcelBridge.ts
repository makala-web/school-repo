import * as XLSX from 'xlsx'
import type { SmsMessagePreview } from './SmsResultsService'
import { normalizeTanzaniaPhoneNumber } from './SmsSender'

interface SmsExcelRow {
  studentId?: string
  studentName: string
  examType: string
  marks: string
  totalMarks: number | string
  averageScore: number | string
  rank: number | string
  totalStudents: number | string
  parentPhoneNumber: string
  message: string
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'sms_results'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export class SmsExcelBridge {
  static async export(previews: SmsMessagePreview[], filename = 'sms_results'): Promise<void> {
    const rows: SmsExcelRow[] = previews.map(item => ({
      studentId: item.studentId,
      studentName: item.studentName,
      examType: item.examType || '',
      marks: item.message
        .split('\n')
        .filter(line => line.includes(':') && line.includes('(') && line.includes(')'))
        .join(' | '),
      totalMarks: item.totalMarks ?? '',
      averageScore: item.averageMarks ?? '',
      rank: item.rank ?? '',
      totalStudents: item.totalStudents ?? '',
      parentPhoneNumber: item.phone || '',
      message: item.message,
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [
      { wch: 24 },
      { wch: 28 },
      { wch: 16 },
      { wch: 60 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
      { wch: 18 },
      { wch: 80 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SMS Results')
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    downloadBlob(new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeFileName(filename)}.xlsx`)
  }

  static async import(file: File): Promise<SmsMessagePreview[]> {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    return rows.map((row, index) => {
      const studentName = String(row.studentName || row['student name'] || row.StudentName || '').trim()
      const phoneInput = String(row.parentPhoneNumber || row['parent phone number'] || row.parentPhone || '').trim()
      const normalizedPhone = phoneInput ? normalizeTanzaniaPhoneNumber(phoneInput) : null
      const phone = normalizedPhone?.valid ? normalizedPhone.phone! : ''
      const message = String(row.message || row.Message || '').trim()

      return {
        studentId: String(row.studentId || `excel-${index + 1}`),
        studentName,
        examType: String(row.examType || row['exam type'] || ''),
        totalMarks: parseNumber(row.totalMarks || row['total marks']),
        averageMarks: parseNumber(row.averageScore || row['average score']),
        rank: parseNumber(row.rank),
        totalStudents: parseNumber(row.totalStudents || row['total students']) ?? undefined,
        phone: phone || null,
        message,
        ready: Boolean(phone && message),
        reason: phone ? (message ? undefined : 'SMS message is missing') : (phoneInput ? normalizedPhone?.error : 'Parent phone number is missing'),
      }
    })
  }
}
