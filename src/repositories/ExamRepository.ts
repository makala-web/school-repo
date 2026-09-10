import { ConnectionManager } from '@/services/database/ConnectionManager'
import type { Exam, ExamType, Class } from '@/types'

export interface CreateExamInput {
  name: string
  examType: ExamType
  classId: string
  schoolId: string
  academicYear: string
  term: string
  examDate?: string
}

export interface UpdateExamInput {
  id: string
  name?: string
  examType?: ExamType
  classId?: string
  academicYear?: string
  term?: string
  examDate?: string | null
}

export interface ExamWithDetails extends Exam {
  class?: {
    id: string
    name: string
    fullName: string
    schoolType: string
  }
  marksCount?: number
}

export class ExamRepository {
  // Get all exams with optional filters
  static async getAll(filters?: { schoolId?: string; classId?: string; academicYear?: string; term?: string }): Promise<ExamWithDetails[]> {
    if (ConnectionManager.isMobile()) {
      return this.getAllSQLite(filters)
    }
    return this.getAllPrisma(filters)
  }

  private static async getAllPrisma(filters?: { schoolId?: string; classId?: string; academicYear?: string; term?: string }): Promise<ExamWithDetails[]> {
    const { db: prismaDb } = await import('@/lib/db')
    const where: Record<string, unknown> = {}
    // Require schoolId to be present and non-empty before returning any data (unless filtering by classId only)
    if (!filters?.classId && (!filters?.schoolId || filters.schoolId.trim() === '')) {
      return []
    }
    if (filters?.schoolId && filters.schoolId.trim() !== '') where.schoolId = filters.schoolId
    if (filters?.classId) where.classId = filters.classId
    if (filters?.academicYear) where.academicYear = filters.academicYear
    if (filters?.term) where.term = filters.term

    const exams = await prismaDb.exam.findMany({
      where,
      include: {
        class: {
          select: { id: true, name: true, fullName: true, schoolType: true }
        },
        _count: {
          select: { marks: true }
        }
      },
      orderBy: [{ examDate: 'desc' }, { createdAt: 'desc' }],
    })

    return exams.map(e => ({
      ...e,
      marksCount: e._count.marks,
    })) as ExamWithDetails[]
  }

  private static async getAllSQLite(filters?: { schoolId?: string; classId?: string; academicYear?: string; term?: string }): Promise<ExamWithDetails[]> {
    const conn = ConnectionManager
    // Require schoolId to be present and non-empty before returning any data (unless filtering by classId only)
    if (!filters?.classId && (!filters?.schoolId || filters.schoolId.trim() === '')) {
      return []
    }
    let sql = `
      SELECT e.*, 
        c.id as class_id, c.name as class_name, c.fullName as class_fullName, c.schoolType as class_schoolType,
        COUNT(m.id) as marksCount
      FROM Exam e
      LEFT JOIN Class c ON e.classId = c.id
      LEFT JOIN MarksEntry m ON m.examId = e.id
      WHERE 1=1
    `
    const params: unknown[] = []

    if (filters?.schoolId && filters.schoolId.trim() !== '') {
      sql += ' AND e.schoolId = ?'
      params.push(filters.schoolId)
    }
    if (filters?.classId) {
      sql += ' AND e.classId = ?'
      params.push(filters.classId)
    }
    if (filters?.academicYear) {
      sql += ' AND e.academicYear = ?'
      params.push(filters.academicYear)
    }
    if (filters?.term) {
      sql += ' AND e.term = ?'
      params.push(filters.term)
    }

    sql += ' GROUP BY e.id ORDER BY e.examDate DESC, e.createdAt DESC'

    const rows = await conn.query<Record<string, unknown>>(sql, params)
    
    return rows.map(row => this.mapRowToExamWithDetails(row))
  }

  // Get exam by ID
  static async getById(id: string): Promise<ExamWithDetails | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByIdSQLite(id)
    }
    return this.getByIdPrisma(id)
  }

  private static async getByIdPrisma(id: string): Promise<ExamWithDetails | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const exam = await prismaDb.exam.findUnique({
      where: { id },
      include: {
        class: {
          select: { id: true, name: true, fullName: true, schoolType: true }
        },
        _count: {
          select: { marks: true }
        }
      },
    })

    if (!exam) return null

    return {
      ...exam,
      marksCount: exam._count.marks,
    } as ExamWithDetails
  }

  private static async getByIdSQLite(id: string): Promise<ExamWithDetails | null> {
    const conn = ConnectionManager
    const rows = await conn.query<Record<string, unknown>>(`
      SELECT e.*, 
        c.id as class_id, c.name as class_name, c.fullName as class_fullName, c.schoolType as class_schoolType,
        COUNT(m.id) as marksCount
      FROM Exam e
      LEFT JOIN Class c ON e.classId = c.id
      LEFT JOIN MarksEntry m ON m.examId = e.id
      WHERE e.id = ?
      GROUP BY e.id
    `, [id])

    if (rows.length === 0) return null
    return this.mapRowToExamWithDetails(rows[0])
  }

  // Create exam
  static async create(input: CreateExamInput): Promise<Exam> {
    if (ConnectionManager.isMobile()) {
      return this.createSQLite(input)
    }
    return this.createPrisma(input)
  }

  private static async createPrisma(input: CreateExamInput): Promise<Exam> {
    const { db: prismaDb } = await import('@/lib/db')
    const exam = await prismaDb.exam.create({
      data: {
        name: input.name,
        examType: input.examType,
        classId: input.classId,
        schoolId: input.schoolId,
        academicYear: input.academicYear,
        term: input.term,
        examDate: input.examDate,
      },
    })
    return exam as Exam
  }

  private static async createSQLite(input: CreateExamInput): Promise<Exam> {
    const conn = ConnectionManager
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await conn.execute(`
      INSERT INTO Exam (id, name, examType, classId, schoolId, academicYear, term, examDate, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, input.name, input.examType, input.classId, input.schoolId,
      input.academicYear, input.term, input.examDate || null, now, now
    ])

    const exam = await this.getById(id)
    if (!exam) throw new Error('Failed to create exam')
    return exam
  }

  // Update exam
  static async update(input: UpdateExamInput): Promise<Exam> {
    if (ConnectionManager.isMobile()) {
      return this.updateSQLite(input)
    }
    return this.updatePrisma(input)
  }

  private static async updatePrisma(input: UpdateExamInput): Promise<Exam> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.exam.findUnique({ where: { id: input.id } })
    if (!existing) {
      throw new Error('Exam not found')
    }

    const exam = await prismaDb.exam.update({
      where: { id: input.id },
      data: {
        name: input.name ?? undefined,
        examType: input.examType ?? undefined,
        classId: input.classId ?? undefined,
        academicYear: input.academicYear ?? undefined,
        term: input.term ?? undefined,
        examDate: input.examDate !== undefined ? input.examDate : undefined,
      },
    })
    return exam as Exam
  }

  private static async updateSQLite(input: UpdateExamInput): Promise<Exam> {
    const conn = ConnectionManager
    
    const existing = await this.getById(input.id)
    if (!existing) {
      throw new Error('Exam not found')
    }

    const updates: string[] = []
    const params: unknown[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      params.push(input.name)
    }
    if (input.examType !== undefined) {
      updates.push('examType = ?')
      params.push(input.examType)
    }
    if (input.classId !== undefined) {
      updates.push('classId = ?')
      params.push(input.classId)
    }
    if (input.academicYear !== undefined) {
      updates.push('academicYear = ?')
      params.push(input.academicYear)
    }
    if (input.term !== undefined) {
      updates.push('term = ?')
      params.push(input.term)
    }
    if (input.examDate !== undefined) {
      updates.push('examDate = ?')
      params.push(input.examDate)
    }

    updates.push('updatedAt = ?')
    params.push(new Date().toISOString())
    params.push(input.id)

    await conn.execute(
      `UPDATE Exam SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    const exam = await this.getById(input.id)
    if (!exam) throw new Error('Failed to update exam')
    return exam
  }

  // Delete exam
  static async delete(id: string): Promise<void> {
    if (ConnectionManager.isMobile()) {
      return this.deleteSQLite(id)
    }
    return this.deletePrisma(id)
  }

  private static async deletePrisma(id: string): Promise<void> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.exam.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Exam not found')
    }

    await prismaDb.exam.delete({ where: { id } })
  }

  private static async deleteSQLite(id: string): Promise<void> {
    const conn = ConnectionManager
    
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error('Exam not found')
    }

    await conn.execute('DELETE FROM Exam WHERE id = ?', [id])
  }

  // Get exams for class
  static async getByClass(classId: string): Promise<ExamWithDetails[]> {
    return this.getAll({ classId })
  }

  // Get distinct academic years
  static async getAcademicYears(schoolId: string): Promise<string[]> {
    if (ConnectionManager.isMobile()) {
      return this.getAcademicYearsSQLite(schoolId)
    }
    return this.getAcademicYearsPrisma(schoolId)
  }

  private static async getAcademicYearsPrisma(schoolId: string): Promise<string[]> {
    const { db: prismaDb } = await import('@/lib/db')
    const exams = await prismaDb.exam.findMany({
      where: { schoolId },
      select: { academicYear: true },
      distinct: ['academicYear'],
      orderBy: { academicYear: 'desc' }
    })
    return exams.map(e => e.academicYear)
  }

  private static async getAcademicYearsSQLite(schoolId: string): Promise<string[]> {
    const conn = ConnectionManager
    const rows = await conn.query<{ academicYear: string }>(`
      SELECT DISTINCT academicYear FROM Exam 
      WHERE schoolId = ? 
      ORDER BY academicYear DESC
    `, [schoolId])
    return rows.map(r => r.academicYear)
  }

  // Get distinct terms for academic year
  static async getTerms(schoolId: string, academicYear: string): Promise<string[]> {
    if (ConnectionManager.isMobile()) {
      return this.getTermsSQLite(schoolId, academicYear)
    }
    return this.getTermsPrisma(schoolId, academicYear)
  }

  private static async getTermsPrisma(schoolId: string, academicYear: string): Promise<string[]> {
    const { db: prismaDb } = await import('@/lib/db')
    const exams = await prismaDb.exam.findMany({
      where: { schoolId, academicYear },
      select: { term: true },
      distinct: ['term'],
      orderBy: { term: 'asc' }
    })
    return exams.map(e => e.term)
  }

  private static async getTermsSQLite(schoolId: string, academicYear: string): Promise<string[]> {
    const conn = ConnectionManager
    const rows = await conn.query<{ term: string }>(`
      SELECT DISTINCT term FROM Exam 
      WHERE schoolId = ? AND academicYear = ?
      ORDER BY term ASC
    `, [schoolId, academicYear])
    return rows.map(r => r.term)
  }

  // Helper: Map database row to ExamWithDetails
  private static mapRowToExamWithDetails(row: Record<string, unknown>): ExamWithDetails {
    const result: ExamWithDetails = {
      id: row.id as string,
      name: row.name as string,
      examType: row.examType as ExamType,
      classId: row.classId as string,
      schoolId: row.schoolId as string,
      academicYear: row.academicYear as string,
      term: row.term as string,
      examDate: row.examDate as string | null,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      marksCount: Number(row.marksCount) || 0,
    }

    if (row.class_id) {
      result.class = {
        id: row.class_id as string,
        name: row.class_name as string,
        fullName: row.class_fullName as string,
        schoolType: row.class_schoolType as string,
      }
    }

    return result
  }
}
