import { ConnectionManager } from '@/services/database/ConnectionManager'
import type { StudentResult, StudentResultWithRelations } from '@/types'

export interface CreateResultInput {
  studentId: string
  examId: string
  classId: string
  totalMarks?: number | null
  averageMarks?: number | null
  grade?: string | null
  division?: string | null
  points?: number | null
  rank?: number | null
  status?: string
  subjectCount?: number
  classTeacherComment?: string | null
  headTeacherComment?: string | null
  closingDate?: string | null
  openingDate?: string | null
  classTeacherSign?: string | null
  headTeacherSign?: string | null
}

export interface UpdateResultInput {
  id: string
  totalMarks?: number | null
  averageMarks?: number | null
  grade?: string | null
  division?: string | null
  points?: number | null
  rank?: number | null
  status?: string
  subjectCount?: number
  classTeacherComment?: string | null
  headTeacherComment?: string | null
  closingDate?: string | null
  openingDate?: string | null
  classTeacherSign?: string | null
  headTeacherSign?: string | null
}

export interface ResultFilters {
  studentId?: string
  examId?: string
  classId?: string
  schoolId?: string
}

export class ResultsRepository {
  // Get all results with optional filters
  static async getAll(filters?: ResultFilters): Promise<StudentResult[]> {
    if (ConnectionManager.isMobile()) {
      return this.getAllSQLite(filters)
    }
    return this.getAllPrisma(filters)
  }

  private static async getAllPrisma(filters?: ResultFilters): Promise<StudentResult[]> {
    const { db: prismaDb } = await import('@/lib/db')
    const where: Record<string, unknown> = {}
    // Safety: require at least one scoping filter to avoid returning all results across schools/users
    if (!filters?.studentId && !filters?.examId && !filters?.classId && !filters?.schoolId) {
      return []
    }
    if (filters?.studentId) where.studentId = filters.studentId
    if (filters?.examId) where.examId = filters.examId
    if (filters?.classId) where.classId = filters.classId
    if (filters?.schoolId) where.class = { schoolId: filters.schoolId }

    const records = await prismaDb.studentResult.findMany({
      where,
      orderBy: { rank: 'asc' },
    })
    return records.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))
  }

  private static async getAllSQLite(filters?: ResultFilters): Promise<StudentResult[]> {
    const conn = ConnectionManager
    // Safety: require at least one scoping filter to avoid returning all results across schools/users
    if (!filters?.studentId && !filters?.examId && !filters?.classId && !filters?.schoolId) {
      return []
    }
    let sql = 'SELECT * FROM StudentResult WHERE 1=1'
    const params: unknown[] = []

    if (filters?.studentId) {
      sql += ' AND studentId = ?'
      params.push(filters.studentId)
    }
    if (filters?.examId) {
      sql += ' AND examId = ?'
      params.push(filters.examId)
    }
    if (filters?.classId) {
      sql += ' AND classId = ?'
      params.push(filters.classId)
    }
    if (filters?.schoolId) {
      sql += ' AND classId IN (SELECT id FROM Class WHERE schoolId = ?)'
      params.push(filters.schoolId)
    }

    sql += ' ORDER BY rank ASC'
    return await conn.query<StudentResult>(sql, params)
  }

  // Get result by ID
  static async getById(id: string): Promise<StudentResult | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByIdSQLite(id)
    }
    return this.getByIdPrisma(id)
  }

  private static async getByIdPrisma(id: string): Promise<StudentResult | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const record = await prismaDb.studentResult.findUnique({ where: { id } })
    if (!record) return null; return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }
  }

  private static async getByIdSQLite(id: string): Promise<StudentResult | null> {
    const conn = ConnectionManager
    const rows = await conn.query<StudentResult>('SELECT * FROM StudentResult WHERE id = ?', [id])
    return rows[0] || null
  }

  // Get result with relations
  static async getByIdWithRelations(id: string): Promise<StudentResultWithRelations | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByIdWithRelationsSQLite(id)
    }
    return this.getByIdWithRelationsPrisma(id)
  }

  private static async getByIdWithRelationsPrisma(id: string): Promise<StudentResultWithRelations | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const record = await prismaDb.studentResult.findUnique({
      where: { id },
      include: {
        student: true,
        exam: true,
        class: true,
      },
    })
    if (!record) return null; return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }
  }

  private static async getByIdWithRelationsSQLite(id: string): Promise<StudentResultWithRelations | null> {
    const conn = ConnectionManager
    const rows = await conn.query<Record<string, unknown>>(`
      SELECT sr.*,
        s.id as s_id, s.fullName as s_fullName, s.admissionNo as s_admissionNo, s.gender as s_gender,
        e.id as e_id, e.name as e_name, e.examType as e_examType, e.academicYear as e_academicYear, e.term as e_term,
        c.id as c_id, c.name as c_name, c.fullName as c_fullName
      FROM StudentResult sr
      JOIN Student s ON sr.studentId = s.id
      JOIN Exam e ON sr.examId = e.id
      JOIN Class c ON sr.classId = c.id
      WHERE sr.id = ?
    `, [id])

    if (rows.length === 0) return null
    return this.mapRowToResultWithRelations(rows[0])
  }

  // Get result by student and exam
  static async getByStudentAndExam(studentId: string, examId: string): Promise<StudentResult | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByStudentAndExamSQLite(studentId, examId)
    }
    return this.getByStudentAndExamPrisma(studentId, examId)
  }

  private static async getByStudentAndExamPrisma(studentId: string, examId: string): Promise<StudentResult | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const record = await prismaDb.studentResult.findUnique({
      where: { studentId_examId: { studentId, examId } },
    })
    if (!record) return null; return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }
  }

  private static async getByStudentAndExamSQLite(studentId: string, examId: string): Promise<StudentResult | null> {
    const conn = ConnectionManager
    const rows = await conn.query<StudentResult>(
      'SELECT * FROM StudentResult WHERE studentId = ? AND examId = ?',
      [studentId, examId]
    )
    return rows[0] || null
  }

  // Create result record
  static async create(input: CreateResultInput): Promise<StudentResult> {
    if (ConnectionManager.isMobile()) {
      return this.createSQLite(input)
    }
    return this.createPrisma(input)
  }

  private static async createPrisma(input: CreateResultInput): Promise<StudentResult> {
    const { db: prismaDb } = await import('@/lib/db')
    const record = await prismaDb.studentResult.create({
      data: {
        studentId: input.studentId,
        examId: input.examId,
        classId: input.classId,
        totalMarks: input.totalMarks,
        averageMarks: input.averageMarks,
        grade: input.grade,
        division: input.division,
        points: input.points,
        rank: input.rank,
        status: input.status || 'INCOMPLETE',
        subjectCount: input.subjectCount || 0,
        classTeacherComment: input.classTeacherComment,
        headTeacherComment: input.headTeacherComment,
        closingDate: input.closingDate,
        openingDate: input.openingDate,
        classTeacherSign: input.classTeacherSign,
        headTeacherSign: input.headTeacherSign,
      },
    })
    return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }
  }

  private static async createSQLite(input: CreateResultInput): Promise<StudentResult> {
    const conn = ConnectionManager
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await conn.execute(
      `INSERT INTO StudentResult (id, studentId, examId, classId, totalMarks, averageMarks, 
        grade, division, points, rank, status, subjectCount, classTeacherComment, headTeacherComment,
        closingDate, openingDate, classTeacherSign, headTeacherSign, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.studentId, input.examId, input.classId, input.totalMarks || null,
       input.averageMarks || null, input.grade || null, input.division || null,
       input.points || null, input.rank || null, input.status || 'INCOMPLETE',
       input.subjectCount || 0, input.classTeacherComment || null, input.headTeacherComment || null,
       input.closingDate || null, input.openingDate || null, input.classTeacherSign || null,
       input.headTeacherSign || null, now, now]
    )

    const record = await this.getById(id)
    if (!record) throw new Error('Failed to create result record')
    return record
  }

  // Update result record
  static async update(input: UpdateResultInput): Promise<StudentResult> {
    if (ConnectionManager.isMobile()) {
      return this.updateSQLite(input)
    }
    return this.updatePrisma(input)
  }

  private static async updatePrisma(input: UpdateResultInput): Promise<StudentResult> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.studentResult.findUnique({ where: { id: input.id } })
    if (!existing) throw new Error('Result record not found')

    const data: Record<string, unknown> = {}
    if (input.totalMarks !== undefined) data.totalMarks = input.totalMarks
    if (input.averageMarks !== undefined) data.averageMarks = input.averageMarks
    if (input.grade !== undefined) data.grade = input.grade
    if (input.division !== undefined) data.division = input.division
    if (input.points !== undefined) data.points = input.points
    if (input.rank !== undefined) data.rank = input.rank
    if (input.status !== undefined) data.status = input.status
    if (input.subjectCount !== undefined) data.subjectCount = input.subjectCount
    if (input.classTeacherComment !== undefined) data.classTeacherComment = input.classTeacherComment
    if (input.headTeacherComment !== undefined) data.headTeacherComment = input.headTeacherComment
    if (input.closingDate !== undefined) data.closingDate = input.closingDate
    if (input.openingDate !== undefined) data.openingDate = input.openingDate
    if (input.classTeacherSign !== undefined) data.classTeacherSign = input.classTeacherSign
    if (input.headTeacherSign !== undefined) data.headTeacherSign = input.headTeacherSign

    const record = await prismaDb.studentResult.update({
      where: { id: input.id },
      data,
    })
    return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }
  }

  private static async updateSQLite(input: UpdateResultInput): Promise<StudentResult> {
    const conn = ConnectionManager
    const existing = await this.getById(input.id)
    if (!existing) throw new Error('Result record not found')

    const updates: string[] = []
    const params: unknown[] = []

    if (input.totalMarks !== undefined) {
      updates.push('totalMarks = ?')
      params.push(input.totalMarks)
    }
    if (input.averageMarks !== undefined) {
      updates.push('averageMarks = ?')
      params.push(input.averageMarks)
    }
    if (input.grade !== undefined) {
      updates.push('grade = ?')
      params.push(input.grade)
    }
    if (input.division !== undefined) {
      updates.push('division = ?')
      params.push(input.division)
    }
    if (input.points !== undefined) {
      updates.push('points = ?')
      params.push(input.points)
    }
    if (input.rank !== undefined) {
      updates.push('rank = ?')
      params.push(input.rank)
    }
    if (input.status !== undefined) {
      updates.push('status = ?')
      params.push(input.status)
    }
    if (input.subjectCount !== undefined) {
      updates.push('subjectCount = ?')
      params.push(input.subjectCount)
    }
    if (input.classTeacherComment !== undefined) {
      updates.push('classTeacherComment = ?')
      params.push(input.classTeacherComment)
    }
    if (input.headTeacherComment !== undefined) {
      updates.push('headTeacherComment = ?')
      params.push(input.headTeacherComment)
    }
    if (input.closingDate !== undefined) {
      updates.push('closingDate = ?')
      params.push(input.closingDate)
    }
    if (input.openingDate !== undefined) {
      updates.push('openingDate = ?')
      params.push(input.openingDate)
    }
    if (input.classTeacherSign !== undefined) {
      updates.push('classTeacherSign = ?')
      params.push(input.classTeacherSign)
    }
    if (input.headTeacherSign !== undefined) {
      updates.push('headTeacherSign = ?')
      params.push(input.headTeacherSign)
    }

    updates.push('updatedAt = ?')
    params.push(new Date().toISOString())
    params.push(input.id)

    await conn.execute(
      `UPDATE StudentResult SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    const record = await this.getById(input.id)
    if (!record) throw new Error('Failed to update result record')
    return record
  }

  // Delete result record
  static async delete(id: string): Promise<void> {
    if (ConnectionManager.isMobile()) {
      return this.deleteSQLite(id)
    }
    return this.deletePrisma(id)
  }

  private static async deletePrisma(id: string): Promise<void> {
    const { db: prismaDb } = await import('@/lib/db')
    await prismaDb.studentResult.delete({ where: { id } })
  }

  private static async deleteSQLite(id: string): Promise<void> {
    const conn = ConnectionManager
    await conn.execute('DELETE FROM StudentResult WHERE id = ?', [id])
  }

  // Calculate ranks for all students in an exam using Dense Ranking
  // Dense Ranking: ties get same rank, next rank is not skipped
  // Example: 490->1, 475->2, 460->3, 460->3, 455->4, 450->5
  static async calculateRanks(examId: string, classId: string): Promise<void> {
    const results = await this.getAll({ examId, classId })

    const complete = results
      .filter(result => result.status === 'COMPLETE' && result.averageMarks !== null && result.averageMarks !== undefined)
      .sort((a, b) => (b.averageMarks || 0) - (a.averageMarks || 0))
    const incomplete = results.filter(result => !complete.some(item => item.id === result.id))

    // Dense Ranking: ties get same rank, next rank is not skipped
    let rank = 1
    for (let i = 0; i < complete.length; i++) {
      if (i > 0 && complete[i].averageMarks !== complete[i - 1].averageMarks) {
        rank = rank + 1
      }
      await this.update({
        id: complete[i].id,
        rank: rank,
      })
    }

    for (const result of incomplete) {
      await this.update({
        id: result.id,
        rank: null,
      })
    }
  }

  // Helper: Map database row to StudentResultWithRelations
  private static mapRowToResultWithRelations(row: Record<string, unknown>): StudentResultWithRelations {
    return {
      id: row.id as string,
      studentId: row.studentId as string,
      examId: row.examId as string,
      classId: row.classId as string,
      totalMarks: (row.totalMarks as number) ?? null,
      averageMarks: (row.averageMarks as number) ?? null,
      grade: (row.grade as string) ?? null,
      division: (row.division as string) ?? null,
      points: (row.points as number) ?? null,
      rank: (row.rank as number) ?? null,
      status: row.status as StudentResult['status'],
      subjectCount: row.subjectCount as number,
      classTeacherComment: (row.classTeacherComment as string) ?? null,
      headTeacherComment: (row.headTeacherComment as string) ?? null,
      closingDate: (row.closingDate as string) ?? null,
      openingDate: (row.openingDate as string) ?? null,
      classTeacherSign: (row.classTeacherSign as string) ?? null,
      headTeacherSign: (row.headTeacherSign as string) ?? null,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      student: {
        id: row.s_id as string,
        fullName: row.s_fullName as string,
        admissionNo: row.s_admissionNo as string,
        gender: row.s_gender as string,
      } as unknown as StudentResultWithRelations['student'],
      exam: {
        id: row.e_id as string,
        name: row.e_name as string,
        examType: row.e_examType as string,
        academicYear: row.e_academicYear as string,
        term: row.e_term as string,
      } as unknown as StudentResultWithRelations['exam'],
      class: {
        id: row.c_id as string,
        name: row.c_name as string,
        fullName: row.c_fullName as string,
      } as unknown as StudentResultWithRelations['class'],
    }
  }
}
