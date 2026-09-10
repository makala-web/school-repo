import { ExamRepository, MarksRepository, ResultsRepository, SchoolRepository, StudentRepository } from '@/repositories'
import { normalizeTanzaniaPhoneNumber } from './SmsSender'

export interface SmsMessagePreview {
  studentId: string
  studentName: string
  examType?: string
  totalMarks?: number | null
  averageMarks?: number | null
  rank?: number | null
  totalStudents?: number
  phone: string | null
  message: string
  ready: boolean
  reason?: string
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function buildMessage(input: {
  studentName: string
  examName: string
  schoolName: string
  marks: Array<{ subjectName: string; marks: number | null; grade: string | null }>
  totalMarks: number | null
  averageMarks: number | null
  rank: number | null
  totalStudents: number
}): string {
  // Use FULL uppercase subject names - never abbreviated
  const subjectLines = input.marks
    .map(mark => `${mark.subjectName.toUpperCase()}: ${formatNumber(mark.marks)} (${(mark.grade || '-').toUpperCase()})`)
    .join('\n')

  return [
    `NDUGU MZAZI WA ${input.studentName.toUpperCase()},`,
    '',
    `MATOKEO YA MWANAO KWA MTIHANI WA ${input.examName.toUpperCase()} NI KAMA IFUATAVYO:`,
    '',
    subjectLines || 'HAKUNA ALAMA ZILIZOREKODIWA.',
    '',
    `JUMLA YA ALAMA: ${formatNumber(input.totalMarks)}`,
    '',
    `WASTANI: ${formatNumber(input.averageMarks)}`,
    '',
    `MWANAO AMEKUWA MWANAFUNZI WA ${input.rank ?? '-'}`,
    '',
    `KATI YA WANAFUNZI ${input.totalStudents}`,
    '',
    'WALIOFANYA MTIHANI HUU.',
    '',
    `TAARIFA HII IMETOLEWA NA OFISI YA TAALUMA YA ${input.schoolName.toUpperCase()}.`,
    '',
    'ASANTE.',
  ].join('\n')
}

export class SmsResultsService {
  static async prepareForStudent(examId: string, studentId: string): Promise<SmsMessagePreview> {
    const student = await StudentRepository.getById(studentId)
    if (!student) {
      throw new Error('Student not found')
    }

    const exam = await ExamRepository.getById(examId)
    if (!exam) {
      throw new Error('Exam not found')
    }

    const school = await SchoolRepository.getById(exam.schoolId || student.schoolId)
    const result = await ResultsRepository.getByStudentAndExam(studentId, examId)
    const classResults = await ResultsRepository.getAll({ examId, classId: exam.classId })
    const marks = await MarksRepository.getByStudentAndExam(studentId, examId)

    const subjectMarks = marks.map(mark => ({
      // Use FULL subject name (not shortName) for parent-friendly SMS
      subjectName: mark.classSubject.subject.name || mark.classSubject.subject.shortName || 'SUBJECT',
      marks: mark.marks ?? null,
      grade: mark.grade ?? null,
    }))

    const totalMarks = result?.totalMarks ?? subjectMarks.reduce((sum, mark) => sum + (mark.marks ?? 0), 0)
    const averageMarks = result?.averageMarks ?? (subjectMarks.length > 0 ? totalMarks / subjectMarks.length : null)
    const totalStudents = classResults.length || 1
    const phoneInput = student.parentPhone?.trim() || ''
    const normalizedPhone = phoneInput ? normalizeTanzaniaPhoneNumber(phoneInput) : null
    const phone = normalizedPhone?.valid ? normalizedPhone.phone! : null

    return {
      studentId: student.id,
      studentName: student.fullName,
      examType: exam.examType || exam.name,
      totalMarks,
      averageMarks,
      rank: result?.rank ?? null,
      totalStudents,
      phone,
      ready: Boolean(phone),
      reason: phone ? undefined : (phoneInput ? normalizedPhone?.error : 'Parent phone number is missing'),
      message: buildMessage({
        studentName: student.fullName,
        examName: exam.examType || exam.name,
        schoolName: school?.name || 'Shule',
        marks: subjectMarks,
        totalMarks,
        averageMarks,
        rank: result?.rank ?? null,
        totalStudents,
      }),
    }
  }

  static async prepareForExam(examId: string): Promise<SmsMessagePreview[]> {
    const exam = await ExamRepository.getById(examId)
    if (!exam) {
      throw new Error('Exam not found')
    }

    // Get only students who have marks for this exam
    const marks = await MarksRepository.getAll({ examId })
    const studentIdsWithMarks = new Set(marks.map(m => m.studentId))
    
    const students = await StudentRepository.getAll({ classId: exam.classId, status: 'ACTIVE' })
    const previews: SmsMessagePreview[] = []

    for (const student of students) {
      // Skip students who have no marks for this exam
      if (!studentIdsWithMarks.has(student.id)) continue
      previews.push(await this.prepareForStudent(examId, student.id))
    }

    return previews
  }
}
