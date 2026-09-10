import { ConnectionManager } from '@/services/database/ConnectionManager'
import { validateRequired, validateLength, validateEnum, generateId } from '@/modules/validation'
import type { Student, StudentWithClass } from '@/types'

export interface CreateStudentInput {
  fullName: string
  gender: 'M' | 'F'
  admissionNo?: string
  dob?: string
  parentName?: string
  parentPhone?: string
  classId: string
  schoolId: string
  status?: 'ACTIVE' | 'TRANSFERRED' | 'GRADUATED'
}

export interface UpdateStudentInput {
  id: string
  fullName?: string
  gender?: 'M' | 'F'
  admissionNo?: string | null
  dob?: string | null
  parentName?: string | null
  parentPhone?: string | null
  classId?: string
  status?: 'ACTIVE' | 'TRANSFERRED' | 'GRADUATED'
}

export interface StudentFilters {
  classId?: string
  schoolId?: string
  search?: string
  status?: string
}

export class StudentRepository {
  // Helper: Generate admission number prefix from class name
  private static getAdmissionPrefix(className: string): string {
    const name = className.trim().toUpperCase()

    // Match "STD X" or "STANDARD X" pattern (Primary)
    const stdMatch = name.match(/(?:STD|STANDARD)\s*(\d+)/)
    if (stdMatch) {
      return `STD${stdMatch[1]}`
    }

    // Match "FORM X" pattern (Secondary)
    const formMatch = name.match(/FORM\s*(\d+)/)
    if (formMatch) {
      return `F${formMatch[1]}`
    }

    // Match "PP X" pattern (Pre-Primary)
    const ppMatch = name.match(/PP\s*(\d+)/)
    if (ppMatch) {
      return `PP${ppMatch[1]}`
    }

    // Fallback: extract any number from the name and combine with first letters
    const numMatch = name.match(/(\d+)/)
    const words = name.split(/\s+/).filter(Boolean)
    if (numMatch && words.length > 0) {
      const prefix = words.map(w => w.charAt(0)).join('').replace(/\d/g, '')
      return `${prefix}${numMatch[1]}`
    }

    // Last fallback: use first 3 chars uppercase
    return name.substring(0, 3)
  }

  // Helper: Generate the next admission number for a given class
  static async generateAdmissionNo(classId: string): Promise<string> {
    if (ConnectionManager.isMobile()) {
      return this.generateAdmissionNoSQLite(classId)
    }
    return this.generateAdmissionNoPrisma(classId)
  }

  private static async generateAdmissionNoPrisma(classId: string): Promise<string> {
    const { db: prismaDb } = await import('@/lib/db')
    const classInfo = await prismaDb.class.findUnique({
      where: { id: classId },
      select: { name: true },
    })

    if (!classInfo) {
      throw new Error('Class not found')
    }

    const prefix = this.getAdmissionPrefix(classInfo.name)

    // Find all students in this class with admission numbers matching the pattern
    const existingStudents = await prismaDb.student.findMany({
      where: {
        classId,
        admissionNo: { startsWith: prefix + '-' },
      },
      select: { admissionNo: true },
    })

    // Extract the highest sequence number
    let maxSeq = 0
    for (const s of existingStudents) {
      if (s.admissionNo) {
        const parts = s.admissionNo.split('-')
        if (parts.length >= 2) {
          const seq = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq
          }
        }
      }
    }

    const nextSeq = maxSeq + 1
    return `${prefix}-${String(nextSeq).padStart(3, '0')}`
  }

  private static async generateAdmissionNoSQLite(classId: string): Promise<string> {
    const conn = ConnectionManager
    const classInfo = await conn.query<{ name: string }>(
      'SELECT name FROM Class WHERE id = ?',
      [classId]
    )

    if (classInfo.length === 0) {
      throw new Error('Class not found')
    }

    const prefix = this.getAdmissionPrefix(classInfo[0].name)

    const existingStudents = await conn.query<{ admissionNo: string }>(
      "SELECT admissionNo FROM Student WHERE classId = ? AND admissionNo LIKE ?",
      [classId, `${prefix}-%`]
    )

    let maxSeq = 0
    for (const s of existingStudents) {
      if (s.admissionNo) {
        const parts = s.admissionNo.split('-')
        if (parts.length >= 2) {
          const seq = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq
          }
        }
      }
    }

    const nextSeq = maxSeq + 1
    return `${prefix}-${String(nextSeq).padStart(3, '0')}`
  }

  // Get all students with optional filters
  static async getAll(filters?: StudentFilters): Promise<StudentWithClass[]> {
    if (ConnectionManager.isMobile()) {
      return this.getAllSQLite(filters)
    }
    return this.getAllPrisma(filters)
  }

  private static async getAllPrisma(filters?: StudentFilters): Promise<StudentWithClass[]> {
    const where: Record<string, unknown> = {}
    
    // Require schoolId to be present and non-empty before returning any data (unless filtering by classId only)
    if (!filters?.classId && (!filters?.schoolId || filters.schoolId.trim() === '')) {
      return []
    }
    if (filters?.classId) where.classId = filters.classId
    if (filters?.schoolId && filters.schoolId.trim() !== '') where.schoolId = filters.schoolId
    if (filters?.status) where.status = filters.status
    if (filters?.search) {
      where.OR = [
        { fullName: { contains: filters.search } },
        { admissionNo: { contains: filters.search } },
        { parentName: { contains: filters.search } },
      ]
    }

    const { db: prismaDb } = await import('@/lib/db')
    const students = await prismaDb.student.findMany({
      where,
      include: {
        class: { select: { name: true, fullName: true, schoolType: true } },
        school: { select: { name: true } },
      },
      orderBy: [{ fullName: 'asc' }],
    })

    return students.map(s => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })) as StudentWithClass[]
  }

  private static async getAllSQLite(filters?: StudentFilters): Promise<StudentWithClass[]> {
    const conn = ConnectionManager
    // Require schoolId to be present and non-empty before returning any data (unless filtering by classId only)
    if (!filters?.classId && (!filters?.schoolId || filters.schoolId.trim() === '')) {
      return []
    }
    let sql = `
      SELECT s.*, 
        c.name as class_name, 
        c.fullName as class_fullName, 
        c.schoolType as class_schoolType,
        sch.name as school_name
      FROM Student s
      LEFT JOIN Class c ON s.classId = c.id
      LEFT JOIN School sch ON s.schoolId = sch.id
      WHERE 1=1
    `
    const params: unknown[] = []

    if (filters?.classId) {
      sql += ' AND s.classId = ?'
      params.push(filters.classId)
    }
    if (filters?.schoolId && filters.schoolId.trim() !== '') {
      sql += ' AND s.schoolId = ?'
      params.push(filters.schoolId)
    }
    if (filters?.status) {
      sql += ' AND s.status = ?'
      params.push(filters.status)
    }
    if (filters?.search) {
      sql += ` AND (s.fullName LIKE ? OR s.admissionNo LIKE ? OR s.parentName LIKE ?)`
      const searchPattern = `%${filters.search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }

    sql += ' ORDER BY s.fullName ASC'

    const rows = await conn.query<Record<string, unknown>>(sql, params)
    
    return rows.map(row => this.mapRowToStudentWithClass(row))
  }

  // Get student by ID
  static async getById(id: string): Promise<StudentWithClass | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByIdSQLite(id)
    }
    return this.getByIdPrisma(id)
  }

  private static async getByIdPrisma(id: string): Promise<StudentWithClass | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const student = await prismaDb.student.findUnique({
      where: { id },
      include: {
        class: { select: { name: true, fullName: true, schoolType: true } },
        school: { select: { name: true } },
      },
    })
    if (!student) return null
    return { ...student, createdAt: student.createdAt.toISOString(), updatedAt: student.updatedAt.toISOString() } as StudentWithClass
  }

  private static async getByIdSQLite(id: string): Promise<StudentWithClass | null> {
    const conn = ConnectionManager
    const rows = await conn.query<Record<string, unknown>>(`
      SELECT s.*, 
        c.name as class_name, 
        c.fullName as class_fullName, 
        c.schoolType as class_schoolType,
        sch.name as school_name
      FROM Student s
      LEFT JOIN Class c ON s.classId = c.id
      LEFT JOIN School sch ON s.schoolId = sch.id
      WHERE s.id = ?
    `, [id])

    if (rows.length === 0) return null
    return this.mapRowToStudentWithClass(rows[0])
  }

  // Create student
  static async create(input: CreateStudentInput, autoGenerateAdmissionNo: boolean = false): Promise<Student> {
    if (ConnectionManager.isMobile()) {
      return this.createSQLite(input, autoGenerateAdmissionNo)
    }
    return this.createPrisma(input, autoGenerateAdmissionNo)
  }

  private static async createPrisma(input: CreateStudentInput, autoGenerateAdmissionNo: boolean): Promise<Student> {
    let admissionNo = input.admissionNo?.trim() || null
    if (!admissionNo || autoGenerateAdmissionNo) {
      admissionNo = await this.generateAdmissionNo(input.classId)
    }

    const { db: prismaDb } = await import('@/lib/db')
    const student = await prismaDb.student.create({
      data: {
        fullName: input.fullName,
        gender: input.gender,
        admissionNo,
        dob: input.dob || null,
        parentName: input.parentName || null,
        parentPhone: input.parentPhone || null,
        status: input.status || 'ACTIVE',
        classId: input.classId,
        schoolId: input.schoolId,
      },
    })

    return { ...student, createdAt: student.createdAt.toISOString(), updatedAt: student.updatedAt.toISOString() } as StudentWithClass
  }

  private static async createSQLite(input: CreateStudentInput, autoGenerateAdmissionNo: boolean): Promise<Student> {
    const conn = ConnectionManager
    
    let admissionNo = input.admissionNo?.trim() || null
    if (!admissionNo || autoGenerateAdmissionNo) {
      admissionNo = await this.generateAdmissionNo(input.classId)
    }

    // Validate required fields
    validateRequired(input as unknown as Record<string, unknown>, ['fullName', 'gender', 'classId', 'schoolId'])
    validateLength(input.fullName, 'Student name', 2, 100)
    validateEnum(input.gender, ['M', 'F'], 'Gender')

    const id = generateId()
    const now = new Date().toISOString()

    await conn.execute(`
      INSERT INTO Student (
        id, fullName, gender, admissionNo, dob, parentName, parentPhone,
        status, classId, schoolId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, input.fullName, input.gender, admissionNo, input.dob || null,
      input.parentName || null, input.parentPhone || null,
      input.status || 'ACTIVE', input.classId, input.schoolId, now, now
    ])

    const student = await this.getById(id)
    if (!student) throw new Error('Failed to create student')
    return student
  }

  // Bulk create students
  static async bulkCreate(students: Array<{
    fullName: string
    gender: 'M' | 'F'
    admissionNo?: string
    dob?: string
    parentName?: string
    parentPhone?: string
  }>, classId: string, schoolId: string): Promise<Student[]> {
    if (ConnectionManager.isMobile()) {
      return this.bulkCreateSQLite(students, classId, schoolId)
    }
    return this.bulkCreatePrisma(students, classId, schoolId)
  }

  private static async bulkCreatePrisma(
    students: Array<{
      fullName: string
      gender: 'M' | 'F'
      admissionNo?: string
      dob?: string
      parentName?: string
      parentPhone?: string
    }>,
    classId: string,
    schoolId: string
  ): Promise<Student[]> {
    const created: Student[] = []
    
    for (const student of students) {
      const admissionNo = student.admissionNo?.trim() || await this.generateAdmissionNo(classId)
      const { db: prismaDb } = await import('@/lib/db')
      const record = await prismaDb.student.create({
        data: {
          fullName: student.fullName,
          gender: student.gender,
          admissionNo,
          dob: student.dob || null,
          parentName: student.parentName || null,
          parentPhone: student.parentPhone || null,
          status: 'ACTIVE',
          classId,
          schoolId,
        },
      })
      created.push({ ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() } as Student)
    }

    return created
  }

  private static async bulkCreateSQLite(
    students: Array<{
      fullName: string
      gender: 'M' | 'F'
      admissionNo?: string
      dob?: string
      parentName?: string
      parentPhone?: string
    }>,
    classId: string,
    schoolId: string
  ): Promise<Student[]> {
    const conn = ConnectionManager
    const created: Student[] = []
    const now = new Date().toISOString()

    const queries: Array<{ sql: string; params: unknown[] }> = []

    for (const student of students) {
      const admissionNo = student.admissionNo?.trim() || await this.generateAdmissionNo(classId)
      const id = crypto.randomUUID()

      queries.push({
        sql: `INSERT INTO Student (id, fullName, gender, admissionNo, dob, parentName, parentPhone, status, classId, schoolId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id, student.fullName, student.gender, admissionNo, student.dob || null,
          student.parentName || null, student.parentPhone || null,
          'ACTIVE', classId, schoolId, now, now
        ]
      })

      created.push({
        id,
        fullName: student.fullName,
        gender: student.gender,
        admissionNo,
        dob: student.dob || null,
        parentName: student.parentName || null,
        parentPhone: student.parentPhone || null,
        status: 'ACTIVE',
        classId,
        schoolId,
        createdAt: now,
        updatedAt: now,
      } as Student)
    }

    await conn.transaction(queries)
    return created
  }

  // Update student
  static async update(input: UpdateStudentInput): Promise<Student> {
    if (ConnectionManager.isMobile()) {
      return this.updateSQLite(input)
    }
    return this.updatePrisma(input)
  }

  private static async updatePrisma(input: UpdateStudentInput): Promise<Student> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.student.findUnique({ where: { id: input.id } })
    if (!existing) {
      throw new Error('Student not found')
    }

    const student = await prismaDb.student.update({
      where: { id: input.id },
      data: {
        fullName: input.fullName ?? undefined,
        gender: input.gender ?? undefined,
        admissionNo: input.admissionNo !== undefined ? input.admissionNo : undefined,
        dob: input.dob !== undefined ? input.dob : undefined,
        parentName: input.parentName !== undefined ? input.parentName : undefined,
        parentPhone: input.parentPhone !== undefined ? input.parentPhone : undefined,
        classId: input.classId ?? undefined,
        status: input.status ?? undefined,
      },
    })

    return { ...student, createdAt: student.createdAt.toISOString(), updatedAt: student.updatedAt.toISOString() } as StudentWithClass
  }

  private static async updateSQLite(input: UpdateStudentInput): Promise<Student> {
    const conn = ConnectionManager
    
    const existing = await this.getById(input.id)
    if (!existing) {
      throw new Error('Student not found')
    }

    const updates: string[] = []
    const params: unknown[] = []

    if (input.fullName !== undefined) {
      updates.push('fullName = ?')
      params.push(input.fullName)
    }
    if (input.gender !== undefined) {
      updates.push('gender = ?')
      params.push(input.gender)
    }
    if (input.admissionNo !== undefined) {
      updates.push('admissionNo = ?')
      params.push(input.admissionNo)
    }
    if (input.dob !== undefined) {
      updates.push('dob = ?')
      params.push(input.dob)
    }
    if (input.parentName !== undefined) {
      updates.push('parentName = ?')
      params.push(input.parentName)
    }
    if (input.parentPhone !== undefined) {
      updates.push('parentPhone = ?')
      params.push(input.parentPhone)
    }
    if (input.classId !== undefined) {
      updates.push('classId = ?')
      params.push(input.classId)
    }
    if (input.status !== undefined) {
      updates.push('status = ?')
      params.push(input.status)
    }

    updates.push('updatedAt = ?')
    params.push(new Date().toISOString())

    params.push(input.id)

    await conn.execute(
      `UPDATE Student SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    const student = await this.getById(input.id)
    if (!student) throw new Error('Failed to update student')
    return student
  }

  // Delete student
  static async delete(id: string): Promise<void> {
    if (ConnectionManager.isMobile()) {
      return this.deleteSQLite(id)
    }
    return this.deletePrisma(id)
  }

  private static async deletePrisma(id: string): Promise<void> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.student.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Student not found')
    }

    await prismaDb.student.delete({ where: { id } })
  }

  private static async deleteSQLite(id: string): Promise<void> {
    const conn = ConnectionManager
    
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error('Student not found')
    }

    await conn.execute('DELETE FROM Student WHERE id = ?', [id])
  }

  // Get students by class
  static async getByClass(classId: string): Promise<StudentWithClass[]> {
    return this.getAll({ classId })
  }

  // Count students
  static async count(filters?: { schoolId?: string; classId?: string; status?: string }): Promise<number> {
    if (ConnectionManager.isMobile()) {
      return this.countSQLite(filters)
    }
    return this.countPrisma(filters)
  }

  private static async countPrisma(filters?: { schoolId?: string; classId?: string; status?: string }): Promise<number> {
    const where: Record<string, unknown> = {}
    if (filters?.schoolId && filters.schoolId.trim() !== '') where.schoolId = filters.schoolId
    if (filters?.classId) where.classId = filters.classId
    if (filters?.status) where.status = filters.status

    const { db: prismaDb } = await import('@/lib/db')
    return await prismaDb.student.count({ where })
  }

  private static async countSQLite(filters?: { schoolId?: string; classId?: string; status?: string }): Promise<number> {
    const conn = ConnectionManager
    // Require at least one scoping filter to avoid returning counts across all schools/users
    if (!filters?.schoolId && !filters?.classId && !filters?.status) {
      return 0
    }
    let sql = 'SELECT COUNT(*) as count FROM Student WHERE 1=1'
    const params: unknown[] = []

    if (filters?.schoolId && filters.schoolId.trim() !== '') {
      sql += ' AND schoolId = ?'
      params.push(filters.schoolId)
    }
    if (filters?.classId) {
      sql += ' AND classId = ?'
      params.push(filters.classId)
    }
    if (filters?.status) {
      sql += ' AND status = ?'
      params.push(filters.status)
    }

    const result = await conn.query<{ count: number }>(sql, params)
    return result[0]?.count || 0
  }

  // Helper: Map database row to StudentWithClass
  private static mapRowToStudentWithClass(row: Record<string, unknown>): StudentWithClass {
    return {
      id: row.id as string,
      fullName: row.fullName as string,
      gender: row.gender as 'M' | 'F',
      admissionNo: row.admissionNo as string | null,
      dob: row.dob as string | null,
      parentName: row.parentName as string | null,
      parentPhone: row.parentPhone as string | null,
      status: row.status as 'ACTIVE' | 'TRANSFERRED' | 'GRADUATED',
      classId: row.classId as string,
      schoolId: row.schoolId as string,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      class: {
        name: (row.class_name || row.name) as string,
        fullName: (row.class_fullName || row.fullName) as string,
        schoolType: (row.class_schoolType || row.schoolType) as 'PRIMARY' | 'SECONDARY',
      },
      school: row.school_name ? { name: row.school_name as string } : undefined,
    }
  }
}
