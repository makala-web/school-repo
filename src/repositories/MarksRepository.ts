import { ConnectionManager } from '@/services/database/ConnectionManager'
import { getActiveDataScope } from '@/lib/store'
import type { MarksEntry, MarksEntryWithRelations, StudentResult, Student, Subject } from '@/types'

export interface CreateMarksInput {
  studentId: string
  classSubjectId: string
  examId: string
  marks: number
  grade?: string
  remarks?: string
}

export interface UpdateMarksInput {
  id: string
  marks?: number
  grade?: string
  remarks?: string
}

export interface MarksFilters {
  examId?: string
  studentId?: string
  classSubjectId?: string
  classId?: string
}

export class MarksRepository {
  // Get all marks with optional filters
  static async getAll(filters?: MarksFilters): Promise<MarksEntryWithRelations[]> {
    if (ConnectionManager.isMobile()) {
      return this.getAllSQLite(filters)
    }
    return this.getAllPrisma(filters)
  }

  private static async getAllPrisma(filters?: MarksFilters): Promise<MarksEntryWithRelations[]> {
    const { db: prismaDb } = await import('@/lib/db')
    // Safety: require at least one scoping filter to avoid returning all marks across schools/users
    if (!filters?.examId && !filters?.studentId && !filters?.classSubjectId && !filters?.classId) {
      return []
    }
    const where: Record<string, unknown> = {}
    if (filters?.examId) where.examId = filters.examId
    if (filters?.studentId) where.studentId = filters.studentId
    if (filters?.classSubjectId) where.classSubjectId = filters.classSubjectId
    if (filters?.classId) where['exam'] = { classId: filters.classId }

    const marks = await prismaDb.marksEntry.findMany({
      where,
      include: {
        student: true,
        classSubject: {
          include: {
            subject: true
          }
        },
        exam: true
      },
      orderBy: { createdAt: 'desc' },
    })

    return marks as MarksEntryWithRelations[]
  }

  private static async getAllSQLite(filters?: MarksFilters): Promise<MarksEntryWithRelations[]> {
    const conn = ConnectionManager
    // Require at least one scoping filter to avoid returning all marks across schools/users
    if (!filters?.examId && !filters?.studentId && !filters?.classSubjectId && !filters?.classId) {
      return []
    }
    let sql = `
      SELECT m.*,
        s.id as s_id, s.fullName as s_fullName, s.gender as s_gender, s.admissionNo as s_admissionNo,
        cs.id as cs_id, cs.subjectId as cs_subjectId,
        sub.id as sub_id, sub.name as sub_name, sub.shortName as sub_shortName,
        e.id as e_id, e.name as e_name, e.examType as e_examType, e.academicYear as e_academicYear, e.term as e_term
      FROM MarksEntry m
      JOIN Student s ON m.studentId = s.id
      JOIN ClassSubject cs ON m.classSubjectId = cs.id
      JOIN Subject sub ON cs.subjectId = sub.id
      JOIN Exam e ON m.examId = e.id
      WHERE 1=1
    `
    const params: unknown[] = []

    if (filters?.examId) {
      sql += ' AND m.examId = ?'
      params.push(filters.examId)
    }
    if (filters?.studentId) {
      sql += ' AND m.studentId = ?'
      params.push(filters.studentId)
    }
    if (filters?.classSubjectId) {
      sql += ' AND m.classSubjectId = ?'
      params.push(filters.classSubjectId)
    }
    if (filters?.classId) {
      sql += ' AND e.classId = ?'
      params.push(filters.classId)
    }

    sql += ' ORDER BY m.createdAt DESC'

    const rows = await conn.query<Record<string, unknown>>(sql, params)
    
    return rows.map(row => this.mapRowToMarksWithRelations(row))
  }

  // Get marks by ID
  static async getById(id: string): Promise<MarksEntryWithRelations | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByIdSQLite(id)
    }
    return this.getByIdPrisma(id)
  }

  private static async getByIdPrisma(id: string): Promise<MarksEntryWithRelations | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const marks = await prismaDb.marksEntry.findUnique({
      where: { id },
      include: {
        student: true,
        classSubject: {
          include: { subject: true }
        },
        exam: true
      },
    })
    return marks as MarksEntryWithRelations | null
  }

  private static async getByIdSQLite(id: string): Promise<MarksEntryWithRelations | null> {
    const conn = ConnectionManager
    const schoolId = getActiveDataScope().schoolId
    if (!schoolId) return null
    const rows = await conn.query<Record<string, unknown>>(`
      SELECT m.*,
        s.id as s_id, s.fullName as s_fullName, s.gender as s_gender, s.admissionNo as s_admissionNo,
        cs.id as cs_id, cs.subjectId as cs_subjectId,
        sub.id as sub_id, sub.name as sub_name, sub.shortName as sub_shortName,
        e.id as e_id, e.name as e_name, e.examType as e_examType, e.academicYear as e_academicYear, e.term as e_term
      FROM MarksEntry m
      JOIN Student s ON m.studentId = s.id
      JOIN ClassSubject cs ON m.classSubjectId = cs.id
      JOIN Subject sub ON cs.subjectId = sub.id
      JOIN Exam e ON m.examId = e.id
      WHERE m.id = ? AND s.schoolId = ? AND e.schoolId = ?
    `, [id, schoolId, schoolId])

    if (rows.length === 0) return null
    return this.mapRowToMarksWithRelations(rows[0])
  }

  // Get marks for student in exam
  static async getByStudentAndExam(studentId: string, examId: string): Promise<MarksEntryWithRelations[]> {
    return this.getAll({ studentId, examId })
  }

  // Get marks for exam with all students
  static async getByExamWithStudents(examId: string, classId: string): Promise<Array<{
    student: Student
    marks: Array<{
      id: string
      marks: number | null
      grade: string | null
      remarks: string | null
      subject: Subject
    }>
  }>> {
    if (ConnectionManager.isMobile()) {
      return this.getByExamWithStudentsSQLite(examId, classId)
    }
    return this.getByExamWithStudentsPrisma(examId, classId)
  }

  private static async getByExamWithStudentsPrisma(examId: string, classId: string): Promise<Array<{
    student: Student
    marks: Array<{
      id: string
      marks: number | null
      grade: string | null
      remarks: string | null
      subject: Subject
    }>
  }>> {
    const { db: prismaDb } = await import('@/lib/db')
    // Get all students in class
    const students = await prismaDb.student.findMany({
      where: { classId, status: 'ACTIVE' },
      orderBy: { fullName: 'asc' }
    })

    // Get all marks for this exam
    const marks = await prismaDb.marksEntry.findMany({
      where: { examId },
      include: {
        student: true,
        classSubject: {
          include: { subject: true }
        }
      }
    })

    // Group by student
    return students.map(student => {
      const studentMarks = marks
        .filter(m => m.studentId === student.id)
        .map(m => ({
          id: m.id,
          marks: m.marks,
          grade: m.grade,
          remarks: m.remarks,
          subject: (m.classSubject as unknown as { subject: Subject }).subject
        }))

      return { student: student as Student, marks: studentMarks }
    })
  }

  private static async getByExamWithStudentsSQLite(examId: string, classId: string): Promise<Array<{
    student: Student
    marks: Array<{
      id: string
      marks: number | null
      grade: string | null
      remarks: string | null
      subject: Subject
    }>
  }>> {
    const conn = ConnectionManager

    // Get all students in class
    const students = await conn.query<Student>(`
      SELECT * FROM Student WHERE classId = ? AND status = ? ORDER BY fullName ASC
    `, [classId, 'ACTIVE'])

    // Get all marks for this exam and class
    const marksRows = await conn.query<{
      m_id: string
      m_marks: number
      m_grade: string
      m_remarks: string
      studentId: string
      sub_id: string
      sub_name: string
      sub_shortName: string
      sub_schoolType: string
      sub_schoolId: string
    }>(`
      SELECT m.id as m_id, m.marks as m_marks, m.grade as m_grade, m.remarks as m_remarks,
        m.studentId,
        sub.id as sub_id, sub.name as sub_name, sub.shortName as sub_shortName,
        sub.schoolType as sub_schoolType, sub.schoolId as sub_schoolId
      FROM MarksEntry m
      JOIN ClassSubject cs ON m.classSubjectId = cs.id
      JOIN Subject sub ON cs.subjectId = sub.id
      WHERE m.examId = ? AND cs.classId = ?
    `, [examId, classId])

    // Group by student
    return students.map(student => {
      const studentMarks = marksRows
        .filter(m => m.studentId === student.id)
        .map(m => ({
          id: m.m_id,
          marks: m.m_marks ?? null,
          grade: m.m_grade ?? null,
          remarks: m.m_remarks ?? null,
          subject: {
            id: m.sub_id,
            name: m.sub_name,
            shortName: m.sub_shortName,
            schoolType: m.sub_schoolType,
            schoolId: m.sub_schoolId,
          } as Subject
        }))

      return { student, marks: studentMarks }
    })
  }

  // Create marks entry
  static async create(input: CreateMarksInput): Promise<MarksEntry> {
    if (ConnectionManager.isMobile()) {
      return this.createSQLite(input)
    }
    return this.createPrisma(input)
  }

  private static async createPrisma(input: CreateMarksInput): Promise<MarksEntry> {
    const { db: prismaDb } = await import('@/lib/db')
    const marks = await prismaDb.marksEntry.create({
      data: {
        studentId: input.studentId,
        classSubjectId: input.classSubjectId,
        examId: input.examId,
        marks: input.marks,
        grade: input.grade,
        remarks: input.remarks,
      },
    })
    return marks as MarksEntry
  }

  private static async createSQLite(input: CreateMarksInput): Promise<MarksEntry> {
    const conn = ConnectionManager
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await conn.execute(`
      INSERT INTO MarksEntry (id, studentId, classSubjectId, examId, marks, grade, remarks, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, input.studentId, input.classSubjectId, input.examId,
      input.marks, input.grade || null, input.remarks || null,
      now, now
    ])

    const marks = await this.getById(id)
    if (!marks) throw new Error('Failed to create marks entry')
    return marks
  }

  // Bulk create marks
  static async bulkCreate(marks: Array<{
    studentId: string
    classSubjectId: string
    examId: string
    marks: number
    grade?: string
    remarks?: string
  }>): Promise<MarksEntry[]> {
    const results: MarksEntry[] = []
    
    for (const mark of marks) {
      try {
        const existing = await this.findByUnique(mark.studentId, mark.classSubjectId, mark.examId)
        if (existing) {
          // Update existing
          const updated = await this.update({
            id: existing.id,
            marks: mark.marks,
            grade: mark.grade,
            remarks: mark.remarks
          })
          results.push(updated)
        } else {
          // Create new
          const created = await this.create(mark)
          results.push(created)
        }
      } catch (error) {
        console.error('Error saving mark:', error)
      }
    }
    
    return results
  }

  // Find by unique constraint
  static async findByUnique(studentId: string, classSubjectId: string, examId: string): Promise<MarksEntry | null> {
    if (ConnectionManager.isMobile()) {
      return this.findByUniqueSQLite(studentId, classSubjectId, examId)
    }
    return this.findByUniquePrisma(studentId, classSubjectId, examId)
  }

  private static async findByUniquePrisma(studentId: string, classSubjectId: string, examId: string): Promise<MarksEntry | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const marks = await prismaDb.marksEntry.findUnique({
      where: {
        studentId_classSubjectId_examId: {
          studentId,
          classSubjectId,
          examId
        }
      }
    })
    return marks as MarksEntry | null
  }

  private static async findByUniqueSQLite(studentId: string, classSubjectId: string, examId: string): Promise<MarksEntry | null> {
    const conn = ConnectionManager
    const rows = await conn.query<MarksEntry>(`
      SELECT * FROM MarksEntry 
      WHERE studentId = ? AND classSubjectId = ? AND examId = ?
    `, [studentId, classSubjectId, examId])
    return rows[0] || null
  }

  // Update marks
  static async update(input: UpdateMarksInput): Promise<MarksEntry> {
    if (ConnectionManager.isMobile()) {
      return this.updateSQLite(input)
    }
    return this.updatePrisma(input)
  }

  private static async updatePrisma(input: UpdateMarksInput): Promise<MarksEntry> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.marksEntry.findUnique({ where: { id: input.id } })
    if (!existing) {
      throw new Error('Marks entry not found')
    }

    const marks = await prismaDb.marksEntry.update({
      where: { id: input.id },
      data: {
        marks: input.marks ?? undefined,
        grade: input.grade !== undefined ? input.grade : undefined,
        remarks: input.remarks !== undefined ? input.remarks : undefined,
      },
    })
    return marks as MarksEntry
  }

  private static async updateSQLite(input: UpdateMarksInput): Promise<MarksEntry> {
    const conn = ConnectionManager
    
    const existing = await this.getById(input.id)
    if (!existing) {
      throw new Error('Marks entry not found')
    }

    const updates: string[] = []
    const params: unknown[] = []

    if (input.marks !== undefined) {
      updates.push('marks = ?')
      params.push(input.marks)
    }
    if (input.grade !== undefined) {
      updates.push('grade = ?')
      params.push(input.grade)
    }
    if (input.remarks !== undefined) {
      updates.push('remarks = ?')
      params.push(input.remarks)
    }

    updates.push('updatedAt = ?')
    params.push(new Date().toISOString())
    params.push(input.id)

    await conn.execute(
      `UPDATE MarksEntry SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    const marks = await this.getById(input.id)
    if (!marks) throw new Error('Failed to update marks')
    return marks
  }

  // Delete marks
  static async delete(id: string): Promise<void> {
    if (ConnectionManager.isMobile()) {
      return this.deleteSQLite(id)
    }
    return this.deletePrisma(id)
  }

  private static async deletePrisma(id: string): Promise<void> {
    const { db: prismaDb } = await import('@/lib/db')
    await prismaDb.marksEntry.delete({ where: { id } })
  }

  private static async deleteSQLite(id: string): Promise<void> {
    const conn = ConnectionManager
    await conn.execute('DELETE FROM MarksEntry WHERE id = ?', [id])
  }

  // Calculate grade from marks
  static calculateGrade(marks: number, gradingConfigs: Array<{ grade: string; minMark: number; maxMark: number; remarks: string }>): { grade: string; remarks: string } {
    for (const config of gradingConfigs) {
      if (marks >= config.minMark && marks <= config.maxMark) {
        return { grade: config.grade, remarks: config.remarks }
      }
    }
    return { grade: 'F', remarks: 'Fail' }
  }

  // Helper: Map database row to MarksEntryWithRelations
  private static mapRowToMarksWithRelations(row: Record<string, unknown>): MarksEntryWithRelations {
    return {
      id: row.id as string,
      studentId: row.studentId as string,
      classSubjectId: row.classSubjectId as string,
      examId: row.examId as string,
      marks: (row.marks as number) ?? null,
      grade: (row.grade as string) ?? null,
      remarks: (row.remarks as string) ?? null,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      student: {
        id: (row.s_id || row.studentId) as string,
        fullName: (row.s_fullName || row.fullName) as string,
        gender: (row.s_gender || row.gender) as 'M' | 'F',
        admissionNo: (row.s_admissionNo || row.admissionNo) as string | null,
        classId: row.classId as string,
        schoolId: row.schoolId as string,
        status: (row.status || 'ACTIVE') as 'ACTIVE' | 'TRANSFERRED' | 'GRADUATED',
        dob: row.dob as string | null,
        parentName: row.parentName as string | null,
        parentPhone: row.parentPhone as string | null,
        createdAt: row.createdAt as string,
        updatedAt: row.updatedAt as string,
      } as Student,
      classSubject: {
        id: (row.cs_id || row.classSubjectId) as string,
        classId: row.classId as string,
        subjectId: (row.cs_subjectId || row.subjectId) as string,
        createdAt: (row.cs_createdAt || row.createdAt) as string,
        subject: {
          id: row.sub_id as string,
          name: row.sub_name as string,
          shortName: row.sub_shortName as string | null,
          schoolType: row.sub_schoolType as 'PRIMARY' | 'SECONDARY' | 'BOTH',
          schoolId: row.sub_schoolId as string,
          createdAt: row.sub_createdAt as string,
          updatedAt: row.sub_updatedAt as string,
        } as Subject,
      },
      exam: {
        id: (row.e_id || row.examId) as string,
        name: row.e_name as string,
        examType: row.e_examType as 'MIDTERM' | 'MONTHLY' | 'TERMINAL' | 'ANNUAL',
        classId: row.classId as string,
        schoolId: row.schoolId as string,
        academicYear: row.e_academicYear as string,
        term: row.e_term as string,
        examDate: row.e_examDate as string | null,
        createdAt: row.e_createdAt as string,
        updatedAt: row.e_updatedAt as string,
      },
    }
  }
}
