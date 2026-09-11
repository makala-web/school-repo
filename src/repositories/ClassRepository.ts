import { ConnectionManager } from '@/services/database/ConnectionManager'
import { validateRequired, validateLength, generateId } from '@/modules/validation'
import type { Class, SchoolType, Student } from '@/types'

export interface CreateClassInput {
  name: string
  stream?: string
  fullName: string
  schoolType: SchoolType
  classTeacherId?: string
  schoolId: string
  academicYear?: string
  term?: string
}

export interface UpdateClassInput {
  id: string
  name?: string
  stream?: string | null
  fullName?: string
  schoolType?: SchoolType
  classTeacherId?: string | null
  academicYear?: string | null
  term?: string | null
}

export interface ClassWithDetails extends Class {
  teacher?: {
    id: string
    name: string
    shortName?: string | null
  } | null
  studentCount?: number
}

export class ClassRepository {
  // Get all classes with optional filters
  static async getAll(filters?: { schoolId?: string; schoolType?: SchoolType }): Promise<ClassWithDetails[]> {
    if (ConnectionManager.isMobile()) {
      return this.getAllSQLite(filters)
    }
    return this.getAllPrisma(filters)
  }

  private static async getAllPrisma(filters?: { schoolId?: string; schoolType?: SchoolType }): Promise<ClassWithDetails[]> {
    const { db: prismaDb } = await import('@/lib/db')
    const where: Record<string, unknown> = {}
    // Require schoolId to be present and non-empty before returning any data
    if (!filters?.schoolId || filters.schoolId.trim() === '') {
      return []
    }
    where.schoolId = filters.schoolId
    if (filters?.schoolType) where.schoolType = filters.schoolType

    const classes = await prismaDb.class.findMany({
      where,
      include: {
        classTeacher: {
          select: { id: true, name: true, shortName: true }
        },
        _count: {
          select: { students: true }
        }
      },
      orderBy: [{ schoolType: 'asc' }, { name: 'asc' }],
    })

    return classes.map(c => ({
      ...c,
      teacher: c.classTeacher,
      studentCount: c._count.students,
    })) as ClassWithDetails[]
  }

  private static async getAllSQLite(filters?: { schoolId?: string; schoolType?: SchoolType }): Promise<ClassWithDetails[]> {
    const conn = ConnectionManager
    // Require schoolId to be present and non-empty before returning any data
    if (!filters?.schoolId || filters.schoolId.trim() === '') {
      return []
    }
    let sql = `
      SELECT c.*, 
        t.id as teacher_id, 
        t.name as teacher_name, 
        t.shortName as teacher_shortName,
        COUNT(s.id) as studentCount
      FROM Class c
      LEFT JOIN Teacher t ON c.classTeacherId = t.id
      LEFT JOIN Student s ON s.classId = c.id AND s.status = 'ACTIVE'
      WHERE c.schoolId = ?
    `
    const params: unknown[] = [filters.schoolId]

    if (filters?.schoolType) {
      sql += ' AND c.schoolType = ?'
      params.push(filters.schoolType)
    }

    sql += ' GROUP BY c.id ORDER BY c.schoolType ASC, c.name ASC'

    const rows = await conn.query<Record<string, unknown>>(sql, params)
    
    return rows.map(row => this.mapRowToClassWithDetails(row))
  }

  // Get class by ID
  static async getById(id: string): Promise<ClassWithDetails | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByIdSQLite(id)
    }
    return this.getByIdPrisma(id)
  }

  private static async getByIdPrisma(id: string): Promise<ClassWithDetails | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const classData = await prismaDb.class.findUnique({
      where: { id },
      include: {
        classTeacher: {
          select: { id: true, name: true, shortName: true }
        },
        _count: {
          select: { students: true }
        }
      },
    })

    if (!classData) return null

    return {
      ...classData,
      teacher: classData.classTeacher,
      studentCount: classData._count.students,
    } as ClassWithDetails
  }

  private static async getByIdSQLite(id: string): Promise<ClassWithDetails | null> {
    const conn = ConnectionManager
    const rows = await conn.query<Record<string, unknown>>(`
      SELECT c.*, 
        t.id as teacher_id, 
        t.name as teacher_name, 
        t.shortName as teacher_shortName,
        COUNT(s.id) as studentCount
      FROM Class c
      LEFT JOIN Teacher t ON c.classTeacherId = t.id
      LEFT JOIN Student s ON s.classId = c.id AND s.status = 'ACTIVE'
      WHERE c.id = ?
      GROUP BY c.id
    `, [id])

    if (rows.length === 0) return null
    return this.mapRowToClassWithDetails(rows[0])
  }

  // Create class
  static async create(input: CreateClassInput): Promise<Class> {
    if (ConnectionManager.isMobile()) {
      return this.createSQLite(input)
    }
    return this.createPrisma(input)
  }

  private static async createPrisma(input: CreateClassInput): Promise<Class> {
    const { db: prismaDb } = await import('@/lib/db')
    const classData = await prismaDb.class.create({
      data: {
        name: input.name,
        stream: input.stream,
        fullName: input.fullName,
        schoolType: input.schoolType,
        classTeacherId: input.classTeacherId,
        schoolId: input.schoolId,
        academicYear: input.academicYear,
        term: input.term,
      },
    })
    return classData as Class
  }

  private static async createSQLite(input: CreateClassInput): Promise<Class> {
    // Validate required fields
    validateRequired(input as unknown as Record<string, unknown>, ['name', 'fullName', 'schoolType', 'schoolId'])
    validateLength(input.name, 'Class name', 1, 50)
    
    const conn = ConnectionManager
    const id = generateId()
    const now = new Date().toISOString()

    await conn.execute(`
      INSERT INTO Class (
        id, name, stream, fullName, schoolType, classTeacherId,
        schoolId, academicYear, term, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, input.name, input.stream || null, input.fullName,
      input.schoolType, input.classTeacherId || null,
      input.schoolId, input.academicYear || null,
      input.term || null, now, now
    ])

    const classData = await this.getById(id)
    if (!classData) throw new Error('Failed to create class')
    return classData
  }

  // Update class
  static async update(input: UpdateClassInput): Promise<Class> {
    if (ConnectionManager.isMobile()) {
      return this.updateSQLite(input)
    }
    return this.updatePrisma(input)
  }

  private static async updatePrisma(input: UpdateClassInput): Promise<Class> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.class.findUnique({ where: { id: input.id } })
    if (!existing) {
      throw new Error('Class not found')
    }

    const classData = await prismaDb.class.update({
      where: { id: input.id },
      data: {
        name: input.name ?? undefined,
        stream: input.stream !== undefined ? input.stream : undefined,
        fullName: input.fullName ?? undefined,
        schoolType: input.schoolType ?? undefined,
        classTeacherId: input.classTeacherId !== undefined ? input.classTeacherId : undefined,
        academicYear: input.academicYear !== undefined ? input.academicYear : undefined,
        term: input.term !== undefined ? input.term : undefined,
      },
    })
    return classData as Class
  }

  private static async updateSQLite(input: UpdateClassInput): Promise<Class> {
    const conn = ConnectionManager
    
    const existing = await this.getById(input.id)
    if (!existing) {
      throw new Error('Class not found')
    }

    const updates: string[] = []
    const params: unknown[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      params.push(input.name)
    }
    if (input.stream !== undefined) {
      updates.push('stream = ?')
      params.push(input.stream)
    }
    if (input.fullName !== undefined) {
      updates.push('fullName = ?')
      params.push(input.fullName)
    }
    if (input.schoolType !== undefined) {
      updates.push('schoolType = ?')
      params.push(input.schoolType)
    }
    if (input.classTeacherId !== undefined) {
      updates.push('classTeacherId = ?')
      params.push(input.classTeacherId)
    }
    if (input.academicYear !== undefined) {
      updates.push('academicYear = ?')
      params.push(input.academicYear)
    }
    if (input.term !== undefined) {
      updates.push('term = ?')
      params.push(input.term)
    }

    updates.push('updatedAt = ?')
    params.push(new Date().toISOString())
    params.push(input.id)

    await conn.execute(
      `UPDATE Class SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    const classData = await this.getById(input.id)
    if (!classData) throw new Error('Failed to update class')
    return classData
  }

  // Delete class
  static async delete(id: string): Promise<void> {
    if (ConnectionManager.isMobile()) {
      return this.deleteSQLite(id)
    }
    return this.deletePrisma(id)
  }

  private static async deletePrisma(id: string): Promise<void> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.class.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Class not found')
    }

    await prismaDb.$transaction(async (tx) => {
      await tx.marksEntry.deleteMany({ where: { OR: [{ student: { classId: id } }, { classSubject: { classId: id } }, { exam: { classId: id } }] } })
      await tx.studentResult.deleteMany({ where: { classId: id } })
      await tx.attendance.deleteMany({ where: { classId: id } })
      await tx.tabia.deleteMany({ where: { classId: id } })
      await tx.exam.deleteMany({ where: { classId: id } })
      await tx.teacherSubject.deleteMany({ where: { classId: id } })
      await tx.classTeacherAssignment.deleteMany({ where: { classId: id } })
      await tx.classSubject.deleteMany({ where: { classId: id } })
      await tx.student.deleteMany({ where: { classId: id } })
      await tx.class.delete({ where: { id } })
    })
  }

  private static async deleteSQLite(id: string): Promise<void> {
    const conn = ConnectionManager
    
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error('Class not found')
    }

    await conn.transaction([
      { sql: 'DELETE FROM MarksEntry WHERE studentId IN (SELECT id FROM Student WHERE classId = ?) OR classSubjectId IN (SELECT id FROM ClassSubject WHERE classId = ?) OR examId IN (SELECT id FROM Exam WHERE classId = ?)', params: [id, id, id] },
      { sql: 'DELETE FROM StudentResult WHERE classId = ?', params: [id] },
      { sql: 'DELETE FROM Attendance WHERE classId = ?', params: [id] },
      { sql: 'DELETE FROM Tabia WHERE classId = ?', params: [id] },
      { sql: 'DELETE FROM Exam WHERE classId = ?', params: [id] },
      { sql: 'DELETE FROM TeacherSubject WHERE classId = ?', params: [id] },
      { sql: 'DELETE FROM ClassSubject WHERE classId = ?', params: [id] },
      { sql: 'DELETE FROM Student WHERE classId = ?', params: [id] },
      { sql: 'DELETE FROM Class WHERE id = ?', params: [id] },
    ])
  }

  // Get students in class
  static async getStudents(classId: string): Promise<Student[]> {
    if (ConnectionManager.isMobile()) {
      return this.getStudentsSQLite(classId)
    }
    return this.getStudentsPrisma(classId)
  }

  private static async getStudentsPrisma(classId: string): Promise<Student[]> {
    const { db: prismaDb } = await import('@/lib/db')
    const students = await prismaDb.student.findMany({
      where: { classId, status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
    })
    return students as Student[]
  }

  private static async getStudentsSQLite(classId: string): Promise<Student[]> {
    const conn = ConnectionManager
    const rows = await conn.query<Student>(
      'SELECT * FROM Student WHERE classId = ? AND status = ? ORDER BY fullName ASC',
      [classId, 'ACTIVE']
    )
    return rows
  }

  // Get subjects for class
  static async getSubjects(classId: string): Promise<Array<{ id: string; subjectId: string; name: string; shortName?: string | null }>> {
    if (ConnectionManager.isMobile()) {
      return this.getSubjectsSQLite(classId)
    }
    return this.getSubjectsPrisma(classId)
  }

  private static async getSubjectsPrisma(classId: string): Promise<Array<{ id: string; subjectId: string; name: string; shortName?: string | null }>> {
    const { db: prismaDb } = await import('@/lib/db')
    const classSubjects = await prismaDb.classSubject.findMany({
      where: { classId },
      include: {
        subject: {
          select: { id: true, name: true, shortName: true }
        }
      }
    })
    
    return classSubjects.map(cs => ({
      id: cs.id,
      subjectId: cs.subject.id,
      name: cs.subject.name,
      shortName: cs.subject.shortName,
    }))
  }

  private static async getSubjectsSQLite(classId: string): Promise<Array<{ id: string; subjectId: string; name: string; shortName?: string | null }>> {
    const conn = ConnectionManager
    const rows = await conn.query<{ id: string; subjectId: string; name: string; shortName: string | null }>(`
      SELECT cs.id, s.id as subjectId, s.name, s.shortName
      FROM ClassSubject cs
      JOIN Subject s ON cs.subjectId = s.id
      WHERE cs.classId = ?
      ORDER BY s.name ASC
    `, [classId])
    
    return rows
  }

  // Assign subject to class
  static async assignSubject(classId: string, subjectId: string): Promise<void> {
    if (ConnectionManager.isMobile()) {
      return this.assignSubjectSQLite(classId, subjectId)
    }
    return this.assignSubjectPrisma(classId, subjectId)
  }

  private static async assignSubjectPrisma(classId: string, subjectId: string): Promise<void> {
    try {
      const { db: prismaDb } = await import('@/lib/db')
      await prismaDb.classSubject.create({
        data: {
          classId,
          subjectId,
        },
      })
    } catch {
      // Ignore duplicate errors
    }
  }

  private static async assignSubjectSQLite(classId: string, subjectId: string): Promise<void> {
    const conn = ConnectionManager
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    try {
      await conn.execute(
        'INSERT INTO ClassSubject (id, classId, subjectId, createdAt) VALUES (?, ?, ?, ?)',
        [id, classId, subjectId, now]
      )
    } catch {
      // Ignore duplicate errors
    }
  }

  // Remove subject from class
  static async removeSubject(classId: string, subjectId: string): Promise<void> {
    if (ConnectionManager.isMobile()) {
      return this.removeSubjectSQLite(classId, subjectId)
    }
    return this.removeSubjectPrisma(classId, subjectId)
  }

  private static async removeSubjectPrisma(classId: string, subjectId: string): Promise<void> {
    const { db: prismaDb } = await import('@/lib/db')
    await prismaDb.classSubject.deleteMany({
      where: { classId, subjectId }
    })
  }

  private static async removeSubjectSQLite(classId: string, subjectId: string): Promise<void> {
    const conn = ConnectionManager
    await conn.execute(
      'DELETE FROM ClassSubject WHERE classId = ? AND subjectId = ?',
      [classId, subjectId]
    )
  }

  // Helper: Map database row to ClassWithDetails
  private static mapRowToClassWithDetails(row: Record<string, unknown>): ClassWithDetails {
    const result: ClassWithDetails = {
      id: row.id as string,
      name: row.name as string,
      stream: row.stream as string | null,
      fullName: row.fullName as string,
      schoolType: row.schoolType as SchoolType,
      classTeacherId: row.classTeacherId as string | null,
      schoolId: row.schoolId as string,
      academicYear: row.academicYear as string | null,
      term: row.term as string | null,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      studentCount: Number(row.studentCount) || 0,
    }

    if (row.teacher_id) {
      result.teacher = {
        id: row.teacher_id as string,
        name: row.teacher_name as string,
        shortName: row.teacher_shortName as string | null,
      }
    }

    return result
  }
}
