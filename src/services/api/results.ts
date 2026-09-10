import { ResultsRepository, type CreateResultInput, type UpdateResultInput } from '@/repositories/ResultsRepository'
import { ApiClient, type ApiResponse } from './ApiClient'
import { ClassRepository, MarksRepository, StudentRepository, ExamRepository, SchoolRepository, TabiaRepository } from '@/repositories'
import { ConnectionManager } from '@/services/database/ConnectionManager'
import type { StudentResult, StudentResultWithRelations } from '@/types'

export interface ResultsListResponse {
  results: StudentResult[]
}

export interface ResultResponse {
  result: StudentResult
}

export interface ResultWithRelationsResponse {
  result: StudentResultWithRelations
}

export const ResultsApi = {
  // GET /api/shulea/results
  async list(params?: { studentId?: string; examId?: string; classId?: string }): Promise<ApiResponse<ResultsListResponse>> {
    try {
      const results = await ResultsRepository.getAll(params)
      return ApiClient.success({ results })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/results/:id
  async getById(id: string): Promise<ApiResponse<ResultWithRelationsResponse>> {
    try {
      const result = await ResultsRepository.getByIdWithRelations(id)
      if (!result) {
        return ApiClient.error('Result not found')
      }
      return ApiClient.success({ result })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // GET /api/shulea/results/by-student-exam
  async getByStudentAndExam(studentId: string, examId: string): Promise<ApiResponse<ResultResponse>> {
    try {
      const result = await ResultsRepository.getByStudentAndExam(studentId, examId)
      if (!result) {
        return ApiClient.error('Result not found')
      }
      return ApiClient.success({ result })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/results
  async create(data: CreateResultInput): Promise<ApiResponse<ResultResponse>> {
    try {
      const result = await ResultsRepository.create(data)
      return ApiClient.success({ result }, 'Result created successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // PUT /api/shulea/results
  async update(data: UpdateResultInput): Promise<ApiResponse<ResultResponse>> {
    try {
      const result = await ResultsRepository.update(data)
      return ApiClient.success({ result }, 'Result updated successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // DELETE /api/shulea/results?id=:id
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      await ResultsRepository.delete(id)
      return ApiClient.success({ message: 'Result deleted successfully' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  // POST /api/shulea/results/calculate-ranks
  async calculateRanks(examId: string, classId: string): Promise<ApiResponse<{ message: string }>> {
    try {
      await ResultsRepository.calculateRanks(examId, classId)
      return ApiClient.success({ message: 'Ranks calculated successfully' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async summary(examId: string, classId: string): Promise<ApiResponse<{ summary: Record<string, unknown> }>> {
    try {
      if (!examId || !classId) return ApiClient.error('Exam ID and Class ID are required for summary')

      const results = await ResultsRepository.getAll({ examId, classId })
      const students = await StudentRepository.getAll({ classId, status: 'ACTIVE' })
      const studentGender = new Map(students.map(student => [student.id, student.gender]))

      const gradeDistribution: Record<string, number> = {}
      const divisionDistribution: Record<string, number> = {}
      let totalAverage = 0
      let completeCount = 0
      let incompleteCount = 0
      let passedCount = 0

      for (const result of results) {
        if (result.status === 'INCOMPLETE') {
          incompleteCount++
          continue
        }

        completeCount++
        const grade = result.grade || 'N/A'
        gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1
        if (result.division) divisionDistribution[result.division] = (divisionDistribution[result.division] || 0) + 1
        if (result.averageMarks) totalAverage += Number(result.averageMarks)
        if (['A', 'B', 'C'].includes(grade)) passedCount++
      }

      const completeResults = results.filter(result => result.status === 'COMPLETE')
      return ApiClient.success({
        summary: {
          totalStudents: results.length,
          completeCount,
          incompleteCount,
          classAverage: completeCount > 0 ? Math.round((totalAverage / completeCount) * 100) / 100 : 0,
          passRate: completeCount > 0 ? Math.round((passedCount / completeCount) * 100) : 0,
          gradeDistribution,
          divisionDistribution,
          genderBreakdown: {
            male: results.filter(result => studentGender.get(result.studentId) === 'M').length,
            female: results.filter(result => studentGender.get(result.studentId) === 'F').length,
          },
          highestScore: completeResults.length > 0 ? Math.max(...completeResults.map(result => Number(result.averageMarks || 0))) : 0,
          lowestScore: completeResults.length > 0 ? Math.min(...completeResults.map(result => Number(result.averageMarks || 0))) : 0,
        },
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async topStudents(examId: string, classId?: string, limit = 10): Promise<ApiResponse<{ topStudents: unknown[] }>> {
    const response = await this.rankedStudents(examId, classId, limit, false)
    if (!response.success) return ApiClient.error(response.error || 'Failed to load top students')
    return ApiClient.success({ topStudents: response.data?.students || [] })
  },

  async bottomStudents(examId: string, classId?: string, limit = 10): Promise<ApiResponse<{ bottomStudents: unknown[] }>> {
    const response = await this.rankedStudents(examId, classId, limit, true)
    if (!response.success) return ApiClient.error(response.error || 'Failed to load bottom students')
    return ApiClient.success({ bottomStudents: response.data?.students || [] })
  },

  async subjectAnalysis(examId: string, classId: string): Promise<ApiResponse<{ analysis: unknown[] }>> {
    try {
      if (!examId || !classId) return ApiClient.error('Exam ID and Class ID are required for subject analysis')

      const classSubjects = await ClassRepository.getSubjects(classId)
      const analysis: Array<Record<string, unknown>> = []

      for (const classSubject of classSubjects) {
        const marks = await MarksRepository.getAll({ examId, classSubjectId: classSubject.id })
        const validMarks = marks.filter(mark => mark.marks != null)
        if (validMarks.length === 0) continue

        const markValues = validMarks.map(mark => Number(mark.marks || 0))
        const total = markValues.reduce((sum, mark) => sum + mark, 0)
        const gradeDistribution: Record<string, number> = {}
        for (const mark of validMarks) {
          const grade = mark.grade || 'N/A'
          gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1
        }

        const passCount = validMarks.filter(mark => mark.grade && ['A', 'B', 'C'].includes(mark.grade)).length
        analysis.push({
          subjectId: classSubject.subjectId,
          subjectName: classSubject.name,
          shortName: classSubject.shortName || null,
          totalStudents: validMarks.length,
          average: Math.round((total / validMarks.length) * 100) / 100,
          highest: Math.max(...markValues),
          lowest: Math.min(...markValues),
          passRate: Math.round((passCount / validMarks.length) * 100),
          gradeDistribution,
        })
      }

      analysis.sort((a, b) => Number(b.average || 0) - Number(a.average || 0))
      return ApiClient.success({ analysis })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async overallResults(examId: string, classId: string): Promise<ApiResponse<Record<string, unknown>>> {
    try {
      if (!examId || !classId) return ApiClient.error('Exam ID and Class ID are required for overall results')

      const subjects = (await ClassRepository.getSubjects(classId)).map(subject => ({
        id: subject.subjectId,
        classSubjectId: subject.id,
        name: subject.name,
        shortName: subject.shortName || null,
      }))
      const students = await StudentRepository.getAll({ classId, status: 'ACTIVE' })
      const marks = await MarksRepository.getAll({ examId, classId })
      const results = await ResultsRepository.getAll({ examId, classId })
      const resultMap = new Map(results.map(result => [result.studentId, result]))

      const marksMap = new Map<string, Map<string, { marks: number | null; grade: string | null }>>()
      for (const mark of marks) {
        const subjectId = mark.classSubject?.subjectId
        if (!subjectId) continue
        if (!marksMap.has(mark.studentId)) marksMap.set(mark.studentId, new Map())
        marksMap.get(mark.studentId)!.set(subjectId, {
          marks: mark.marks ?? null,
          grade: mark.grade ?? null,
        })
      }

      const studentRows = students.map(student => {
        const subjectMarks: Record<string, { marks: number | null; grade: string | null }> = {}
        for (const subject of subjects) {
          subjectMarks[subject.id] = marksMap.get(student.id)?.get(subject.id) || { marks: null, grade: null }
        }

        const result = resultMap.get(student.id)
        return {
          studentInfo: {
            id: student.id,
            fullName: student.fullName,
            gender: student.gender,
            admissionNo: student.admissionNo || null,
          },
          subjectMarks,
          result: result ? {
            average: result.averageMarks ?? null,
            grade: result.grade ?? null,
            points: result.points ?? null,
            division: result.division ?? null,
            rank: result.rank ?? null,
            status: result.status,
            subjectCount: result.subjectCount,
          } : null,
        }
      })

      studentRows.sort((a, b) => {
        if (a.result && b.result) {
          if (a.result.status === 'COMPLETE' && b.result.status !== 'COMPLETE') return -1
          if (a.result.status !== 'COMPLETE' && b.result.status === 'COMPLETE') return 1
          return Number(b.result.average || 0) - Number(a.result.average || 0)
        }
        if (!a.result && !b.result) return 0
        return !a.result ? 1 : -1
      })

      return ApiClient.success({
        students: studentRows,
        subjects: subjects.map(({ classSubjectId: _classSubjectId, ...subject }) => subject),
        totalStudents: students.length,
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async reportCard(studentId: string, examId: string): Promise<ApiResponse<{ reportCard: Record<string, unknown> }>> {
    try {
      if (!studentId || !examId) return ApiClient.error('Student ID and Exam ID are required for report card')

      const conn = ConnectionManager
      const studentRows = await conn.query<Record<string, unknown>>(`
        SELECT s.*, c.id as class_id, c.name as class_name, c.fullName as class_fullName,
          c.schoolType as class_schoolType, c.academicYear as class_academicYear, c.term as class_term,
          c.classTeacherId as class_teacherId
        FROM Student s
        JOIN Class c ON s.classId = c.id
        WHERE s.id = ?
      `, [studentId])
      const student = studentRows[0]
      if (!student) return ApiClient.error('Student not found')

      const exam = await ExamRepository.getById(examId)
      if (!exam) return ApiClient.error('Exam not found')

      const school = await SchoolRepository.getById(student.schoolId as string)
      const result = await ResultsRepository.getByStudentAndExam(studentId, examId)
      const tabiaRows = await TabiaRepository.getAll({ studentId, classId: student.classId as string, examId })
      const marks = await MarksRepository.getAll({ studentId, examId, classId: student.classId as string })
      const teacherRows = await conn.query<Record<string, unknown>>(`
        SELECT ts.subjectId, t.name as teacherName
        FROM TeacherSubject ts
        JOIN Teacher t ON ts.teacherId = t.id
        WHERE ts.classId = ?
      `, [student.classId])
      const classTeacherRows = student.class_teacherId
        ? await conn.query<Record<string, unknown>>('SELECT name, shortName, sign FROM Teacher WHERE id = ?', [student.class_teacherId])
        : []
      const teacherMap = new Map(teacherRows.map(row => [row.subjectId as string, row.teacherName as string]))

      return ApiClient.success({
        reportCard: {
          student: {
            id: student.id,
            fullName: student.fullName,
            gender: student.gender,
            admissionNo: student.admissionNo || null,
            dob: student.dob || null,
          },
          class: {
            id: student.class_id,
            name: student.class_name,
            fullName: student.class_fullName,
            schoolType: student.class_schoolType,
            academicYear: student.class_academicYear || null,
            term: student.class_term || null,
          },
          school: school || null,
          exam: {
            id: exam.id,
            name: exam.name,
            examType: exam.examType,
            term: exam.term,
            academicYear: exam.academicYear,
            examDate: exam.examDate || null,
          },
          marks: marks.map(mark => ({
            subjectName: mark.classSubject.subject.name,
            shortName: mark.classSubject.subject.shortName || null,
            marks: mark.marks ?? null,
            grade: mark.grade ?? null,
            remarks: mark.remarks ?? null,
            teacherName: teacherMap.get(mark.classSubject.subjectId) || '',
          })),
          result: result ? {
            totalMarks: result.totalMarks ?? null,
            averageMarks: result.averageMarks ?? null,
            grade: result.grade ?? null,
            division: result.division ?? null,
            points: result.points ?? null,
            rank: result.rank ?? null,
            status: result.status,
            subjectCount: result.subjectCount,
            classTeacherComment: result.classTeacherComment ?? null,
            headTeacherComment: result.headTeacherComment ?? null,
            closingDate: result.closingDate ?? null,
            openingDate: result.openingDate ?? null,
          } : null,
          tabia: tabiaRows[0] || null,
          classTeacher: classTeacherRows[0] ? {
            name: classTeacherRows[0].name,
            shortName: classTeacherRows[0].shortName || null,
            sign: classTeacherRows[0].sign || null,
          } : null,
        },
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async updateDates(studentId: string, examId: string, closingDate?: string, openingDate?: string): Promise<ApiResponse<ResultResponse>> {
    try {
      const existing = await ResultsRepository.getByStudentAndExam(studentId, examId)
      if (!existing) return ApiClient.error('Result not found')

      const result = await ResultsRepository.update({
        id: existing.id,
        closingDate: closingDate || existing.closingDate || null,
        openingDate: openingDate || existing.openingDate || null,
      })
      return ApiClient.success({ result }, 'Dates updated successfully')
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async updateDatesForClass(classId: string, examId: string, closingDate?: string, openingDate?: string): Promise<ApiResponse<{ updated: number; message: string }>> {
    try {
      if (!classId || !examId) return ApiClient.error('Exam ID and Class ID are required')

      const results = await ResultsRepository.getAll({ examId, classId })
      let updated = 0

      for (const existing of results) {
        await ResultsRepository.update({
          id: existing.id,
          closingDate: closingDate || null,
          openingDate: openingDate || null,
        })
        updated++
      }

      return ApiClient.success({ updated, message: 'Dates updated successfully' })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },

  async rankedStudents(examId: string, classId: string | undefined, limit: number, ascending: boolean): Promise<ApiResponse<{ students: unknown[] }>> {
    try {
      if (!examId) return ApiClient.error('Exam ID is required')
      if (ConnectionManager.isMobile()) {
        const rows = await ConnectionManager.query<Record<string, unknown>>(`
          SELECT
            r.*,
            s.id as student_id,
            s.fullName as student_fullName,
            s.gender as student_gender,
            s.admissionNo as student_admissionNo,
            c.id as class_id,
            c.name as class_name,
            c.fullName as class_fullName,
            c.schoolType as class_schoolType
          FROM StudentResult r
          INNER JOIN Student s ON s.id = r.studentId
          LEFT JOIN Class c ON c.id = r.classId
          WHERE r.examId = ?
            ${classId ? 'AND r.classId = ?' : ''}
            AND r.averageMarks IS NOT NULL
          ORDER BY COALESCE(r.averageMarks, 0) ${ascending ? 'ASC' : 'DESC'}
          LIMIT ?
        `, classId ? [examId, classId, limit] : [examId, limit])

        return ApiClient.success({
          students: rows.map(row => ({
            id: row.id,
            studentId: row.studentId,
            examId: row.examId,
            classId: row.classId,
            totalMarks: row.totalMarks,
            averageMarks: row.averageMarks,
            grade: row.grade,
            division: row.division,
            points: row.points,
            rank: row.rank,
            status: row.status,
            subjectCount: row.subjectCount,
            student: {
              id: row.student_id,
              fullName: row.student_fullName,
              gender: row.student_gender,
              admissionNo: row.student_admissionNo,
            },
            class: {
              id: row.class_id,
              name: row.class_name,
              fullName: row.class_fullName,
              schoolType: row.class_schoolType,
            },
          })),
        })
      }

      const results = await ResultsRepository.getAll({ examId, classId })
      
      // Sort all results, not just COMPLETE ones, to ensure single students are shown
      const sortedResults = results.sort((a, b) => {
        // Prioritize COMPLETE results
        if (a.status === 'COMPLETE' && b.status !== 'COMPLETE') return -1
        if (a.status !== 'COMPLETE' && b.status === 'COMPLETE') return 1
        
        // Then sort by average marks
        return ascending
          ? Number(a.averageMarks || 0) - Number(b.averageMarks || 0)
          : Number(b.averageMarks || 0) - Number(a.averageMarks || 0)
      }).slice(0, limit)

      const students = await StudentRepository.getAll({})
      const studentMap = new Map(students.map(student => [student.id, student]))

      return ApiClient.success({
        students: sortedResults.map(result => ({
          ...result,
          student: studentMap.get(result.studentId) || null,
        })),
      })
    } catch (error) {
      return ApiClient.error((error as Error).message)
    }
  },
}
