// Marks API Service
import { ClassRepository, MarksRepository, type CreateMarksInput, type UpdateMarksInput, type MarksFilters } from '@/repositories'
import { ApiClient, type ApiResponse } from './ApiClient'
import type { MarksEntry, MarksEntryWithRelations, Student, Subject } from '@/types'
import { ConnectionManager } from '@/services/database/ConnectionManager'

export interface MarksListResponse {
  marks: MarksEntryWithRelations[]
}

export interface MarksResponse {
  mark: MarksEntryWithRelations
}

export interface StudentMarksResponse {
  student: Student
  marks: Array<{
    id: string
    marks: number | null
    grade: string | null
    remarks: string | null
    subject: Subject
  }>
}

export interface BulkMarksResponse {
  message: string
  saved: number
}

export const MarksApi = {
  // GET /api/shulea/marks
  async list(filters?: MarksFilters): Promise<ApiResponse<MarksListResponse>> {
    try {
      const marks = await MarksRepository.getAll(filters)
      return ApiClient.success({ marks })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async entryData(params: { classId: string; examId: string; subjectId?: string }): Promise<ApiResponse<{
    marks: MarksEntry[]
    students: Student[]
    classSubjects: Array<{ id: string; subjectId: string; subjectName: string; shortName?: string | null }>
    schoolType: string
  }>> {
    try {
      if (!params.classId || !params.examId) {
        return ApiClient.error('Class ID and Exam ID are required')
      }

      const classRecord = await ClassRepository.getById(params.classId)
      if (!classRecord) {
        return ApiClient.error('Class not found')
      }

      const classSubjects = await ClassRepository.getSubjects(params.classId)
      const selectedClassSubject = params.subjectId
        ? classSubjects.find(subject => subject.subjectId === params.subjectId)
        : undefined
      const marks = await MarksRepository.getAll({
        examId: params.examId,
        classId: params.classId,
        classSubjectId: selectedClassSubject?.id,
      })
      const students = await ClassRepository.getStudents(params.classId)

      return ApiClient.success({
        marks,
        students,
        classSubjects: classSubjects.map(subject => ({
          id: subject.id,
          subjectId: subject.subjectId,
          subjectName: subject.name,
          shortName: subject.shortName,
        })),
        schoolType: classRecord.schoolType,
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/marks/:id
  async getById(id: string): Promise<ApiResponse<MarksResponse>> {
    try {
      const mark = await MarksRepository.getById(id)
      if (!mark) {
        return ApiClient.error('Marks entry not found')
      }
      return ApiClient.success({ mark })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/marks
  async create(data: CreateMarksInput): Promise<ApiResponse<MarksResponse>> {
    try {
      const mark = await MarksRepository.create(data)
      const markWithRelations = await MarksRepository.getById(mark.id)
      return ApiClient.success({ mark: markWithRelations! }, 'Marks saved successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // PUT /api/shulea/marks
  async update(data: UpdateMarksInput): Promise<ApiResponse<MarksResponse>> {
    try {
      const mark = await MarksRepository.update(data)
      const markWithRelations = await MarksRepository.getById(mark.id)
      return ApiClient.success({ mark: markWithRelations! }, 'Marks updated successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // DELETE /api/shulea/marks?id=:id
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      await MarksRepository.delete(id)
      return ApiClient.success({ message: 'Marks deleted successfully' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/marks/student/:studentId/exam/:examId
  async getByStudentAndExam(studentId: string, examId: string): Promise<ApiResponse<MarksListResponse>> {
    try {
      const marks = await MarksRepository.getByStudentAndExam(studentId, examId)
      return ApiClient.success({ marks })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/marks/exam/:examId/class/:classId
  async getByExamWithStudents(examId: string, classId: string): Promise<ApiResponse<{ students: StudentMarksResponse[] }>> {
    try {
      const students = await MarksRepository.getByExamWithStudents(examId, classId)
      return ApiClient.success({ students })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/marks/bulk
  async bulkCreate(marks: Array<{
    studentId: string
    classSubjectId: string
    examId: string
    marks: number
    grade?: string
    remarks?: string
  }>): Promise<ApiResponse<BulkMarksResponse>> {
    try {
      const saved = await MarksRepository.bulkCreate(marks)
      return ApiClient.success({
        message: `${saved.length} marks saved successfully`,
        saved: saved.length
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  }
}

function gradeFromMarks(marks: number, schoolType: string): { grade: string; remarks: string; points?: number } {
  if (schoolType === 'PRIMARY') {
    if (marks >= 41) return { grade: 'A', remarks: 'Excellent' }
    if (marks >= 31) return { grade: 'B', remarks: 'Very Good' }
    if (marks >= 21) return { grade: 'C', remarks: 'Good' }
    if (marks >= 11) return { grade: 'D', remarks: 'Satisfactory' }
    return { grade: 'E', remarks: 'Poor' }
  }

  if (marks >= 75) return { grade: 'A', remarks: 'Excellent', points: 1 }
  if (marks >= 65) return { grade: 'B', remarks: 'Very Good', points: 2 }
  if (marks >= 45) return { grade: 'C', remarks: 'Good', points: 3 }
  if (marks >= 30) return { grade: 'D', remarks: 'Satisfactory', points: 4 }
  return { grade: 'F', remarks: 'Fail', points: 5 }
}

function divisionFromPoints(points: number): string {
  if (points >= 7 && points <= 17) return 'I'
  if (points >= 18 && points <= 21) return 'II'
  if (points >= 22 && points <= 25) return 'III'
  if (points >= 26 && points <= 33) return 'IV'
  return '0'
}

export async function bulkSaveMarks(
  classId: string,
  marks: Array<{ studentId: string; classSubjectId: string; examId: string; marks?: number | null }>
): Promise<ApiResponse<BulkMarksResponse>> {
  try {
    if (!Array.isArray(marks) || marks.length === 0) {
      return ApiClient.error('Marks array is required')
    }

    const classRecord = await ClassRepository.getById(classId)
    if (!classRecord) return ApiClient.error('Class not found')

    const maxMarks = classRecord.schoolType === 'PRIMARY' ? 50 : 100
    const prepared = marks.map(mark => {
      if (mark.marks != null && (mark.marks < 0 || mark.marks > maxMarks)) {
        throw new Error(`Invalid mark ${mark.marks}. Must be between 0 and ${maxMarks}.`)
      }

      const computed = mark.marks != null ? gradeFromMarks(mark.marks, classRecord.schoolType) : null
      return {
        studentId: mark.studentId,
        classSubjectId: mark.classSubjectId,
        examId: mark.examId,
        marks: mark.marks ?? 0,
        grade: computed?.grade,
        remarks: computed?.remarks,
      }
    })

    return MarksApi.bulkCreate(prepared)
  } catch (error) {
    return ApiClient.error((error as Error).message)
  }
}

export async function computeMarksResults(classId: string, examId: string): Promise<ApiResponse<Record<string, unknown>>> {
  try {
    const classRecord = await ClassRepository.getById(classId)
    if (!classRecord) return ApiClient.error('Class not found')

    const students = await ClassRepository.getStudents(classId)
    const marks = await MarksRepository.getAll({ classId, examId })
    const minSubjectsRequired = classRecord.schoolType === 'SECONDARY' ? 7 : 1
    const byStudent = new Map<string, MarksEntryWithRelations[]>()

    for (const mark of marks) {
      if (mark.marks == null) continue
      byStudent.set(mark.studentId, [...(byStudent.get(mark.studentId) || []), mark])
    }

    const results = students.map(student => {
      const studentMarks = byStudent.get(student.id) || []
      const subjectCount = new Set(studentMarks.map(mark => mark.classSubjectId)).size
      const totalMarks = studentMarks.reduce((sum, mark) => sum + Number(mark.marks || 0), 0)

      if (subjectCount < minSubjectsRequired) {
        return {
          studentId: student.id,
          studentName: student.fullName,
          totalMarks: subjectCount > 0 ? totalMarks : null,
          averageMarks: null,
          grade: null,
          division: null,
          points: null,
          rank: null as number | null,
          status: 'INCOMPLETE',
          subjectCount,
        }
      }

      const averageMarks = Math.round((totalMarks / subjectCount) * 100) / 100
      const computed = gradeFromMarks(averageMarks, classRecord.schoolType)
      const points = classRecord.schoolType === 'SECONDARY'
        ? studentMarks
            .map(mark => gradeFromMarks(Number(mark.marks || 0), 'SECONDARY').points || 5)
            .sort((a, b) => a - b)
            .slice(0, 7)
            .reduce((sum, point) => sum + point, 0)
        : null

      return {
        studentId: student.id,
        studentName: student.fullName,
        totalMarks,
        averageMarks,
        grade: computed.grade,
        division: points == null ? null : divisionFromPoints(points),
        points,
        rank: null as number | null,
        status: 'COMPLETE',
        subjectCount,
      }
    })

    const completeResults = results
      .filter(result => result.status === 'COMPLETE')
      .sort((a, b) => Number(b.averageMarks || 0) - Number(a.averageMarks || 0))

    let currentRank = 1
    for (let index = 0; index < completeResults.length; index++) {
      if (index > 0 && completeResults[index].averageMarks !== completeResults[index - 1].averageMarks) {
        currentRank = index + 1
      }
      completeResults[index].rank = currentRank
    }

    const now = new Date().toISOString()
    await ConnectionManager.transaction(results.map(result => ({
      sql: `INSERT INTO StudentResult (
        id, studentId, examId, classId, totalMarks, averageMarks, grade, division, points, rank,
        status, subjectCount, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(studentId, examId) DO UPDATE SET
        totalMarks = excluded.totalMarks,
        averageMarks = excluded.averageMarks,
        grade = excluded.grade,
        division = excluded.division,
        points = excluded.points,
        rank = excluded.rank,
        status = excluded.status,
        subjectCount = excluded.subjectCount,
        updatedAt = excluded.updatedAt`,
      params: [
        crypto.randomUUID(),
        result.studentId,
        examId,
        classId,
        result.totalMarks,
        result.averageMarks,
        result.grade,
        result.division,
        result.points,
        result.rank,
        result.status,
        result.subjectCount,
        now,
        now,
      ],
    })))

    const completeCount = completeResults.length
    const incompleteCount = results.length - completeCount

    return ApiClient.success({
      message: `Results computed: ${completeCount} complete, ${incompleteCount} incomplete (need ${minSubjectsRequired}+ subjects)`,
      results,
      totalStudents: students.length,
      completeCount,
      incompleteCount,
      minSubjectsRequired,
      schoolType: classRecord.schoolType,
    })
  } catch (error) {
    return ApiClient.error((error as Error).message)
  }
}
