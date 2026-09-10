import { ConnectionManager } from '@/services/database/ConnectionManager'
import type { Subject, SchoolType } from '@/types'

export interface CreateSubjectInput {
  name: string
  shortName?: string
  schoolType: 'PRIMARY' | 'SECONDARY' | 'BOTH'
  schoolId: string
}

export interface UpdateSubjectInput {
  id: string
  name?: string
  shortName?: string | null
  schoolType?: 'PRIMARY' | 'SECONDARY' | 'BOTH'
}

export interface SubjectWithClasses extends Subject {
  classCount?: number
  classes?: Array<{
    id: string
    name: string
    fullName: string
  }>
}

export class SubjectRepository {
  // Get all subjects with optional filters
  static async getAll(filters?: { schoolId?: string; schoolType?: SchoolType }): Promise<SubjectWithClasses[]> {
    if (ConnectionManager.isMobile()) {
      return this.getAllSQLite(filters)
    }
    return this.getAllPrisma(filters)
  }

  private static async getAllPrisma(filters?: { schoolId?: string; schoolType?: SchoolType }): Promise<SubjectWithClasses[]> {
    const { db: prismaDb } = await import('@/lib/db')
    const where: Record<string, unknown> = {}
    // Require schoolId to be present and non-empty before returning any data
    if (!filters?.schoolId || filters.schoolId.trim() === '') {
      return []
    }
    where.schoolId = filters.schoolId
    if (filters?.schoolType) {
      where.OR = [
        { schoolType: filters.schoolType },
        { schoolType: 'BOTH' }
      ]
    }

    const subjects = await prismaDb.subject.findMany({
      where,
      include: {
        _count: {
          select: { classSubjects: true }
        },
        classSubjects: {
          include: {
            class: {
              select: { id: true, name: true, fullName: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' },
    })

    return subjects.map(s => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      classCount: s._count.classSubjects,
      classes: s.classSubjects.map(cs => cs.class),
    })) as SubjectWithClasses[]
  }

  private static async getAllSQLite(filters?: { schoolId?: string; schoolType?: SchoolType }): Promise<SubjectWithClasses[]> {
    const conn = ConnectionManager
    // Require schoolId to be present and non-empty before returning any data
    if (!filters?.schoolId || filters.schoolId.trim() === '') {
      return []
    }
    let sql = `
      SELECT s.*, COUNT(cs.id) as classCount
      FROM Subject s
      LEFT JOIN ClassSubject cs ON s.id = cs.subjectId
      WHERE s.schoolId = ?
    `
    const params: unknown[] = [filters.schoolId]

    if (filters?.schoolType) {
      sql += ' AND (s.schoolType = ? OR s.schoolType = ?)'
      params.push(filters.schoolType, 'BOTH')
    }

    sql += ' GROUP BY s.id ORDER BY s.name ASC'

    const rows = await conn.query<Record<string, unknown>>(sql, params)
    
    const subjects = rows.map(row => this.mapRowToSubjectWithClasses(row))

    // Load classes for each subject
    for (const subject of subjects) {
      subject.classes = await this.getSubjectClasses(subject.id)
    }

    return subjects
  }

  // Get subject by ID
  static async getById(id: string): Promise<SubjectWithClasses | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByIdSQLite(id)
    }
    return this.getByIdPrisma(id)
  }

  private static async getByIdPrisma(id: string): Promise<SubjectWithClasses | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const subject = await prismaDb.subject.findUnique({
      where: { id },
      include: {
        _count: {
          select: { classSubjects: true }
        },
        classSubjects: {
          include: {
            class: {
              select: { id: true, name: true, fullName: true }
            }
          }
        }
      },
    })

    if (!subject) return null

    return {
      ...subject,
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString(),
      classCount: subject._count.classSubjects,
      classes: subject.classSubjects.map(cs => cs.class),
    } as SubjectWithClasses
  }

  private static async getByIdSQLite(id: string): Promise<SubjectWithClasses | null> {
    const conn = ConnectionManager
    const rows = await conn.query<Record<string, unknown>>(`
      SELECT s.*, COUNT(cs.id) as classCount
      FROM Subject s
      LEFT JOIN ClassSubject cs ON s.id = cs.subjectId
      WHERE s.id = ?
      GROUP BY s.id
    `, [id])

    if (rows.length === 0) return null
    
    const subject = this.mapRowToSubjectWithClasses(rows[0])
    subject.classes = await this.getSubjectClasses(id)
    return subject
  }

  // Get classes for a subject
  private static async getSubjectClasses(subjectId: string): Promise<Array<{ id: string; name: string; fullName: string }>> {
    const conn = ConnectionManager
    const rows = await conn.query<{ id: string; name: string; fullName: string }>(`
      SELECT c.id, c.name, c.fullName
      FROM ClassSubject cs
      JOIN Class c ON cs.classId = c.id
      WHERE cs.subjectId = ?
      ORDER BY c.name ASC
    `, [subjectId])
    return rows
  }

  // Create subject
  static async create(input: CreateSubjectInput): Promise<Subject> {
    if (ConnectionManager.isMobile()) {
      return this.createSQLite(input)
    }
    return this.createPrisma(input)
  }

  private static async createPrisma(input: CreateSubjectInput): Promise<Subject> {
    const { db: prismaDb } = await import('@/lib/db')
    const subject = await prismaDb.subject.create({
      data: {
        name: input.name,
        shortName: input.shortName,
        schoolType: input.schoolType,
        schoolId: input.schoolId,
      },
    })
    return {
      ...subject,
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString(),
    } as Subject
  }

  private static async createSQLite(input: CreateSubjectInput): Promise<Subject> {
    const conn = ConnectionManager
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await conn.execute(`
      INSERT INTO Subject (id, name, shortName, schoolType, schoolId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id, input.name, input.shortName || null,
      input.schoolType, input.schoolId, now, now
    ])

    const subject = await this.getById(id)
    if (!subject) throw new Error('Failed to create subject')
    return subject
  }

  // Update subject
  static async update(input: UpdateSubjectInput): Promise<Subject> {
    if (ConnectionManager.isMobile()) {
      return this.updateSQLite(input)
    }
    return this.updatePrisma(input)
  }

  private static async updatePrisma(input: UpdateSubjectInput): Promise<Subject> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.subject.findUnique({ where: { id: input.id } })
    if (!existing) {
      throw new Error('Subject not found')
    }

    const subject = await prismaDb.subject.update({
      where: { id: input.id },
      data: {
        name: input.name ?? undefined,
        shortName: input.shortName !== undefined ? input.shortName : undefined,
        schoolType: input.schoolType ?? undefined,
      },
    })
    return {
      ...subject,
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString(),
    } as Subject
  }

  private static async updateSQLite(input: UpdateSubjectInput): Promise<Subject> {
    const conn = ConnectionManager
    
    const existing = await this.getById(input.id)
    if (!existing) {
      throw new Error('Subject not found')
    }

    const updates: string[] = []
    const params: unknown[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      params.push(input.name)
    }
    if (input.shortName !== undefined) {
      updates.push('shortName = ?')
      params.push(input.shortName)
    }
    if (input.schoolType !== undefined) {
      updates.push('schoolType = ?')
      params.push(input.schoolType)
    }

    updates.push('updatedAt = ?')
    params.push(new Date().toISOString())
    params.push(input.id)

    await conn.execute(
      `UPDATE Subject SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    const subject = await this.getById(input.id)
    if (!subject) throw new Error('Failed to update subject')
    return subject
  }

  // Delete subject
  static async delete(id: string): Promise<void> {
    if (ConnectionManager.isMobile()) {
      return this.deleteSQLite(id)
    }
    return this.deletePrisma(id)
  }

  private static async deletePrisma(id: string): Promise<void> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.subject.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Subject not found')
    }

    await prismaDb.subject.delete({ where: { id } })
  }

  private static async deleteSQLite(id: string): Promise<void> {
    const conn = ConnectionManager
    
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error('Subject not found')
    }

    await conn.execute('DELETE FROM Subject WHERE id = ?', [id])
  }

  // Seed default subjects for school
  static async seedSubjects(schoolId: string, schoolType: SchoolType): Promise<void> {
    console.log('[SUBJECTS] Seeding subjects for school:', schoolId, 'Type:', schoolType)
    const subjects = this.getDefaultSubjects(schoolType)
    console.log('[SUBJECTS] Default subjects to seed:', subjects.length, subjects)

    let created = 0
    for (const subject of subjects) {
      try {
        await this.create({
          ...subject,
          schoolId,
        })
        created++
        console.log('[SUBJECTS] Created subject:', subject.name)
      } catch (error) {
        console.log('[SUBJECTS] Failed to create subject:', subject.name, error)
        // Ignore duplicates
      }
    }
    console.log('[SUBJECTS] Seeding complete. Created:', created, 'of', subjects.length)
  }

  private static getDefaultSubjects(schoolType: SchoolType): Array<Omit<CreateSubjectInput, 'schoolId'>> {
    if (schoolType === 'PRIMARY') {
      // Tanzania Primary School Subjects
      return [
        { name: 'Kiswahili', shortName: 'KIS', schoolType: 'PRIMARY' },
        { name: 'English Language', shortName: 'ENG', schoolType: 'PRIMARY' },
        { name: 'Mathematics', shortName: 'MAT', schoolType: 'PRIMARY' },
        { name: 'Science', shortName: 'SCI', schoolType: 'PRIMARY' },
        { name: 'Social Studies', shortName: 'SST', schoolType: 'PRIMARY' },
        { name: 'Vocational Skills', shortName: 'STK', schoolType: 'PRIMARY' },
        { name: 'Creative Arts', shortName: 'ART', schoolType: 'PRIMARY' },
        { name: 'Information and Communication Technology', shortName: 'ICT', schoolType: 'PRIMARY' },
        // Pre-Primary Subjects
        { name: 'Language and Communication', shortName: 'LCM', schoolType: 'PRIMARY' },
        { name: 'Mathematics (Pre-Primary)', shortName: 'MAT', schoolType: 'PRIMARY' },
        { name: 'Science and Environment', shortName: 'SCE', schoolType: 'PRIMARY' },
        { name: 'Creative Arts (Pre-Primary)', shortName: 'CRA', schoolType: 'PRIMARY' },
        { name: 'Health and Physical Games', shortName: 'HPG', schoolType: 'PRIMARY' },
        { name: 'Moral and Civic Values', shortName: 'MCV', schoolType: 'PRIMARY' },
      ]
    } else {
      // Tanzania Secondary School Subjects (Form I - IV)
      return [
        // Core Subjects
        { name: 'Basic Mathematics', shortName: 'BM', schoolType: 'SECONDARY' },
        { name: 'English Language', shortName: 'ENG', schoolType: 'SECONDARY' },
        { name: 'Kiswahili', shortName: 'KIS', schoolType: 'SECONDARY' },
        { name: 'Biology', shortName: 'BIO', schoolType: 'SECONDARY' },
        { name: 'Chemistry', shortName: 'CHE', schoolType: 'SECONDARY' },
        { name: 'Physics', shortName: 'PHY', schoolType: 'SECONDARY' },
        { name: 'Geography', shortName: 'GEO', schoolType: 'SECONDARY' },
        { name: 'History', shortName: 'HIS', schoolType: 'SECONDARY' },
        { name: 'Civics', shortName: 'CIV', schoolType: 'SECONDARY' },
        // Business Subjects
        { name: 'Commerce', shortName: 'COM', schoolType: 'SECONDARY' },
        { name: 'Book Keeping', shortName: 'BKS', schoolType: 'SECONDARY' },
        // Arts & Humanities
        { name: 'Literature in English', shortName: 'LIT', schoolType: 'SECONDARY' },
        // Languages
        { name: 'French', shortName: 'FRE', schoolType: 'SECONDARY' },
        { name: 'Arabic', shortName: 'ARA', schoolType: 'SECONDARY' },
        // Agriculture & Home Economics
        { name: 'Agricultural Science', shortName: 'AGR', schoolType: 'SECONDARY' },
        { name: 'Food and Human Nutrition', shortName: 'FHN', schoolType: 'SECONDARY' },
        // Technical Subjects
        { name: 'Information and Computer Studies', shortName: 'ICS', schoolType: 'SECONDARY' },
        { name: 'Fine Art', shortName: 'FAT', schoolType: 'SECONDARY' },
        { name: 'Music', shortName: 'MUS', schoolType: 'SECONDARY' },
        { name: 'Physical Education', shortName: 'PE', schoolType: 'SECONDARY' },
        { name: 'Textile and Dressmaking', shortName: 'T&D', schoolType: 'SECONDARY' },
        { name: 'Additional Mathematics', shortName: 'ADD/M', schoolType: 'SECONDARY' },
        // Religious Subjects
        { name: 'Islamic Knowledge', shortName: 'IKS', schoolType: 'SECONDARY' },
        { name: 'Bible Knowledge', shortName: 'BKSR', schoolType: 'SECONDARY' },
      ]
    }
  }

  // Helper: Map database row to SubjectWithClasses
  private static mapRowToSubjectWithClasses(row: Record<string, unknown>): SubjectWithClasses {
    return {
      id: row.id as string,
      name: row.name as string,
      shortName: row.shortName as string | null,
      schoolType: row.schoolType as 'PRIMARY' | 'SECONDARY' | 'BOTH',
      schoolId: row.schoolId as string,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      classCount: Number(row.classCount) || 0,
    }
  }
}
