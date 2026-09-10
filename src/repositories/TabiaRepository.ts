import { ConnectionManager } from '@/services/database/ConnectionManager'
import type { Tabia } from '@/types'

export interface CreateTabiaInput {
  studentId: string
  classId: string
  examId?: string | null
  discipline?: string | null
  hygiene?: string | null
  hardWorking?: string | null
  cooperation?: string | null
  honesty?: string | null
  leadership?: string | null
  sports?: string | null
}

export interface UpdateTabiaInput {
  id: string
  discipline?: string | null
  hygiene?: string | null
  hardWorking?: string | null
  cooperation?: string | null
  honesty?: string | null
  leadership?: string | null
  sports?: string | null
}

export interface TabiaFilters {
  studentId?: string
  classId?: string
  examId?: string
  schoolId?: string
}

export class TabiaRepository {
  // Get all tabia records with optional filters
  static async getAll(filters?: TabiaFilters): Promise<Tabia[]> {
    if (ConnectionManager.isMobile()) {
      return this.getAllSQLite(filters)
    }
    return this.getAllPrisma(filters)
  }

  private static async getAllPrisma(filters?: TabiaFilters): Promise<Tabia[]> {
    const { db: prismaDb } = await import('@/lib/db')
    // Safety: require at least one scoping filter to avoid returning all tabia records across schools/users
    if (!filters?.studentId && !filters?.classId && !filters?.examId && !filters?.schoolId) {
      return []
    }

    const where: Record<string, unknown> = {}
    if (filters?.studentId) where.studentId = filters.studentId
    if (filters?.classId) where.classId = filters.classId
    if (filters?.examId) where.examId = filters.examId
    if (filters?.schoolId) where['class'] = { schoolId: filters.schoolId }

    const records = await prismaDb.tabia.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return records.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }))
  }

  private static async getAllSQLite(filters?: TabiaFilters): Promise<Tabia[]> {
    const conn = ConnectionManager
    // Require at least one scoping filter to avoid returning all tabia records across schools/users
    if (!filters?.studentId && !filters?.classId && !filters?.examId) {
      return []
    }
    let sql = 'SELECT * FROM Tabia WHERE 1=1'
    const params: unknown[] = []

    if (filters?.studentId) {
      sql += ' AND studentId = ?'
      params.push(filters.studentId)
    }
    if (filters?.classId) {
      sql += ' AND classId = ?'
      params.push(filters.classId)
    }
    if (filters?.examId) {
      sql += ' AND examId = ?'
      params.push(filters.examId)
    }

    sql += ' ORDER BY createdAt DESC'
    return await conn.query<Tabia>(sql, params)
  }

  // Get tabia by ID
  static async getById(id: string): Promise<Tabia | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByIdSQLite(id)
    }
    return this.getByIdPrisma(id)
  }

  private static async getByIdPrisma(id: string): Promise<Tabia | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const record = await prismaDb.tabia.findUnique({ where: { id } })
    if (!record) return null
    return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }
  }

  private static async getByIdSQLite(id: string): Promise<Tabia | null> {
    const conn = ConnectionManager
    const rows = await conn.query<Tabia>('SELECT * FROM Tabia WHERE id = ?', [id])
    return rows[0] || null
  }

  // Get tabia for a student in a specific exam
  static async getByStudentAndExam(studentId: string, examId: string): Promise<Tabia | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByStudentAndExamSQLite(studentId, examId)
    }
    return this.getByStudentAndExamPrisma(studentId, examId)
  }

  private static async getByStudentAndExamPrisma(studentId: string, examId: string): Promise<Tabia | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const record = await prismaDb.tabia.findUnique({
      where: { studentId_classId_examId: { studentId, classId: '', examId } },
    })
    if (!record) return null
    return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }
  }

  private static async getByStudentAndExamSQLite(studentId: string, examId: string): Promise<Tabia | null> {
    const conn = ConnectionManager
    const rows = await conn.query<Tabia>(
      'SELECT * FROM Tabia WHERE studentId = ? AND examId = ?',
      [studentId, examId]
    )
    return rows[0] || null
  }

  // Create tabia record
  static async create(input: CreateTabiaInput): Promise<Tabia> {
    if (ConnectionManager.isMobile()) {
      return this.createSQLite(input)
    }
    return this.createPrisma(input)
  }

  private static async createPrisma(input: CreateTabiaInput): Promise<Tabia> {
    const { db: prismaDb } = await import('@/lib/db')
    const record = await prismaDb.tabia.create({
      data: {
        studentId: input.studentId,
        classId: input.classId,
        examId: input.examId,
        discipline: input.discipline,
        hygiene: input.hygiene,
        hardWorking: input.hardWorking,
        cooperation: input.cooperation,
        honesty: input.honesty,
        leadership: input.leadership,
        sports: input.sports,
      },
    })
    return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }
  }

  private static async createSQLite(input: CreateTabiaInput): Promise<Tabia> {
    const conn = ConnectionManager
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await conn.execute(
      `INSERT INTO Tabia (id, studentId, classId, examId, discipline, hygiene, hardWorking, 
        cooperation, honesty, leadership, sports, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.studentId, input.classId, input.examId || null, input.discipline || null,
       input.hygiene || null, input.hardWorking || null, input.cooperation || null,
       input.honesty || null, input.leadership || null, input.sports || null, now, now]
    )

    const record = await this.getById(id)
    if (!record) throw new Error('Failed to create tabia record')
    return record
  }

  // Update tabia record
  static async update(input: UpdateTabiaInput): Promise<Tabia> {
    if (ConnectionManager.isMobile()) {
      return this.updateSQLite(input)
    }
    return this.updatePrisma(input)
  }

  private static async updatePrisma(input: UpdateTabiaInput): Promise<Tabia> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.tabia.findUnique({ where: { id: input.id } })
    if (!existing) throw new Error('Tabia record not found')

    const data: Record<string, unknown> = {}
    if (input.discipline !== undefined) data.discipline = input.discipline
    if (input.hygiene !== undefined) data.hygiene = input.hygiene
    if (input.hardWorking !== undefined) data.hardWorking = input.hardWorking
    if (input.cooperation !== undefined) data.cooperation = input.cooperation
    if (input.honesty !== undefined) data.honesty = input.honesty
    if (input.leadership !== undefined) data.leadership = input.leadership
    if (input.sports !== undefined) data.sports = input.sports

    const record = await prismaDb.tabia.update({
      where: { id: input.id },
      data,
    })
    return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }
  }

  private static async updateSQLite(input: UpdateTabiaInput): Promise<Tabia> {
    const conn = ConnectionManager
    const existing = await this.getById(input.id)
    if (!existing) throw new Error('Tabia record not found')

    const updates: string[] = []
    const params: unknown[] = []

    if (input.discipline !== undefined) {
      updates.push('discipline = ?')
      params.push(input.discipline)
    }
    if (input.hygiene !== undefined) {
      updates.push('hygiene = ?')
      params.push(input.hygiene)
    }
    if (input.hardWorking !== undefined) {
      updates.push('hardWorking = ?')
      params.push(input.hardWorking)
    }
    if (input.cooperation !== undefined) {
      updates.push('cooperation = ?')
      params.push(input.cooperation)
    }
    if (input.honesty !== undefined) {
      updates.push('honesty = ?')
      params.push(input.honesty)
    }
    if (input.leadership !== undefined) {
      updates.push('leadership = ?')
      params.push(input.leadership)
    }
    if (input.sports !== undefined) {
      updates.push('sports = ?')
      params.push(input.sports)
    }

    updates.push('updatedAt = ?')
    params.push(new Date().toISOString())
    params.push(input.id)

    await conn.execute(
      `UPDATE Tabia SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    const record = await this.getById(input.id)
    if (!record) throw new Error('Failed to update tabia record')
    return record
  }

  // Delete tabia record
  static async delete(id: string): Promise<void> {
    if (ConnectionManager.isMobile()) {
      return this.deleteSQLite(id)
    }
    return this.deletePrisma(id)
  }

  private static async deletePrisma(id: string): Promise<void> {
    const { db: prismaDb } = await import('@/lib/db')
    await prismaDb.tabia.delete({ where: { id } })
  }

  private static async deleteSQLite(id: string): Promise<void> {
    const conn = ConnectionManager
    await conn.execute('DELETE FROM Tabia WHERE id = ?', [id])
  }

  // Bulk save tabia records for a class exam
  static async bulkSaveForExam(
    classId: string,
    examId: string,
    records: Array<{
      studentId: string
      discipline?: string
      hygiene?: string
      hardWorking?: string
      cooperation?: string
      honesty?: string
      leadership?: string
      sports?: string
    }>
  ): Promise<Tabia[]> {
    const results: Tabia[] = []
    for (const record of records) {
      try {
        // Check if record already exists
        const existing = await this.getByStudentAndExam(record.studentId, examId)
        if (existing) {
          // Update existing
          const updated = await this.update({
            id: existing.id,
            discipline: record.discipline,
            hygiene: record.hygiene,
            hardWorking: record.hardWorking,
            cooperation: record.cooperation,
            honesty: record.honesty,
            leadership: record.leadership,
            sports: record.sports,
          })
          results.push(updated)
        } else {
          // Create new
          const created = await this.create({
            studentId: record.studentId,
            classId,
            examId,
            discipline: record.discipline,
            hygiene: record.hygiene,
            hardWorking: record.hardWorking,
            cooperation: record.cooperation,
            honesty: record.honesty,
            leadership: record.leadership,
            sports: record.sports,
          })
          results.push(created)
        }
      } catch (error) {
        console.error('Error saving tabia:', error)
      }
    }
    return results
  }
}
