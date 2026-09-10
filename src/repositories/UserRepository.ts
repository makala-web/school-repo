// User Repository
// Handles all User database operations - supports both Prisma (web) and SQLite (mobile)

import { ConnectionManager } from '@/services/database/ConnectionManager'
import { validateRequired, validateEmail, validateLength, generateId } from '@/modules/validation'
import type { User } from '@/types'

export interface CreateUserInput {
  email: string
  username: string
  password: string
  fullName: string
  role?: string
  schoolId?: string
  schoolType?: 'PRIMARY' | 'SECONDARY' | string
  securityQuestion?: string
  securityAnswer?: string
  active?: boolean
}

export interface UpdateUserInput {
  email?: string
  username?: string
  password?: string
  fullName?: string
  role?: string
  schoolId?: string
  schoolType?: 'PRIMARY' | 'SECONDARY' | string | null
  active?: boolean
  securityQuestion?: string
  securityAnswer?: string
}

export class UserRepository {
  // Count all users (for checking if any exist)
  static async count(): Promise<number> {
    if (ConnectionManager.isMobile()) {
      return this.countSQLite()
    }
    return this.countPrisma()
  }

  private static async countPrisma(): Promise<number> {
    const { db: prismaDb } = await import('@/lib/db')
    return prismaDb.user.count()
  }

  private static async countSQLite(): Promise<number> {
    const conn = ConnectionManager
    const result = await conn.query<{ count: number }>('SELECT COUNT(*) as count FROM User')
    return result[0]?.count || 0
  }

  // Get all users
  static async getAll(filters?: { schoolId?: string }): Promise<User[]> {
    if (ConnectionManager.isMobile()) {
      return this.getAllSQLite(filters)
    }
    return this.getAllPrisma(filters)
  }

  private static async getAllPrisma(filters?: { schoolId?: string }): Promise<User[]> {
    const { db: prismaDb } = await import('@/lib/db')
    const where: Record<string, unknown> = {}
    // Require schoolId to be present and non-empty before returning any data
    if (!filters?.schoolId || filters.schoolId.trim() === '') {
      return []
    }
    where.schoolId = filters.schoolId
    const users = await prismaDb.user.findMany({
      where,
      include: { school: true, teacher: true },
      orderBy: { createdAt: 'desc' }
    })
    return users.map(u => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      school: u.school ? {
        ...u.school,
        createdAt: u.school.createdAt.toISOString(),
        updatedAt: u.school.updatedAt.toISOString(),
      } : null,
      teacher: u.teacher ? {
        ...u.teacher,
        createdAt: u.teacher.createdAt.toISOString(),
        updatedAt: u.teacher.updatedAt.toISOString(),
      } : null,
    })) as User[]
  }

  private static async getAllSQLite(filters?: { schoolId?: string }): Promise<User[]> {
    const conn = ConnectionManager
    // Require schoolId to be present and non-empty before returning any data
    if (!filters?.schoolId || filters.schoolId.trim() === '') {
      return []
    }
    let sql = `
      SELECT u.*,
        s.id as school_id,
        s.name as school_name,
        s.schoolType as school_schoolType,
        s.logo as school_logo,
        s.logo2 as school_logo2,
        s.council as school_council,
        s.region as school_region,
        s.district as school_district,
        s.ward as school_ward,
        s.headTeacherName as school_headTeacherName,
        s.registrationNo as school_registrationNo,
        s.phone as school_phone,
        t.name as teacher_name
      FROM User u
      LEFT JOIN School s ON u.schoolId = s.id
      LEFT JOIN Teacher t ON t.userId = u.id
      WHERE u.schoolId = ?
    `
    const params: unknown[] = [filters.schoolId]
    sql += ' ORDER BY u.createdAt DESC'
    const rows = await conn.query<Record<string, unknown>>(sql, params)
    return rows.map(r => this.mapRowToUser(r))
  }

  // Get user by ID
  static async getById(id: string): Promise<User | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByIdSQLite(id)
    }
    return this.getByIdPrisma(id)
  }

  // Alias for getById (for test compatibility)
  static async findById(id: string): Promise<User | null> {
    return this.getById(id)
  }

  // Find user by email
  static async findByEmail(email: string): Promise<User | null> {
    if (ConnectionManager.isMobile()) {
      return this.findByEmailSQLite(email)
    }
    return this.findByEmailPrisma(email)
  }

  private static async findByEmailPrisma(email: string): Promise<User | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const user = await prismaDb.user.findUnique({
      where: { email },
      include: { school: true, teacher: true }
    })
    if (!user) return null
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      school: user.school ? {
        ...user.school,
        createdAt: user.school.createdAt.toISOString(),
        updatedAt: user.school.updatedAt.toISOString(),
      } : null,
      teacher: user.teacher ? {
        ...user.teacher,
        createdAt: user.teacher.createdAt.toISOString(),
        updatedAt: user.teacher.updatedAt.toISOString(),
      } : null,
    } as User
  }

  private static async findByEmailSQLite(email: string): Promise<User | null> {
    const conn = ConnectionManager
    const sql = `
      SELECT u.*,
        s.id as school_id,
        s.name as school_name,
        s.schoolType as school_schoolType,
        s.logo as school_logo,
        s.logo2 as school_logo2,
        s.council as school_council,
        s.region as school_region,
        s.district as school_district,
        s.ward as school_ward,
        s.headTeacherName as school_headTeacherName,
        s.registrationNo as school_registrationNo,
        s.phone as school_phone,
        t.name as teacher_name
      FROM User u
      LEFT JOIN School s ON u.schoolId = s.id
      LEFT JOIN Teacher t ON u.teacherId = t.id
      WHERE u.email = ?
      LIMIT 1
    `
    const rows = await conn.query<Record<string, unknown>>(sql, [email])
    if (rows.length === 0) return null
    return this.mapRowToUser(rows[0])
  }

  private static async getByIdPrisma(id: string): Promise<User | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const user = await prismaDb.user.findUnique({
      where: { id },
      include: { school: true, teacher: true }
    })
    if (!user) return null
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      school: user.school ? {
        ...user.school,
        createdAt: user.school.createdAt.toISOString(),
        updatedAt: user.school.updatedAt.toISOString(),
      } : null,
      teacher: user.teacher ? {
        ...user.teacher,
        createdAt: user.teacher.createdAt.toISOString(),
        updatedAt: user.teacher.updatedAt.toISOString(),
      } : null,
    } as User
  }

  private static async getByIdSQLite(id: string): Promise<User | null> {
    const conn = ConnectionManager
    const sql = `
      SELECT u.*,
        s.id as school_id,
        s.name as school_name,
        s.schoolType as school_schoolType,
        s.logo as school_logo,
        s.logo2 as school_logo2,
        s.council as school_council,
        s.region as school_region,
        s.district as school_district,
        s.ward as school_ward,
        s.headTeacherName as school_headTeacherName,
        s.registrationNo as school_registrationNo,
        s.phone as school_phone,
        t.name as teacher_name
      FROM User u
      LEFT JOIN School s ON u.schoolId = s.id
      LEFT JOIN Teacher t ON t.userId = u.id
      WHERE u.id = ?
    `
    const rows = await conn.query<Record<string, unknown>>(sql, [id])
    return rows.length > 0 ? this.mapRowToUser(rows[0]) : null
  }

  // Get user by email
  static async getByEmail(email: string): Promise<User | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByEmailSQLite(email)
    }
    return this.getByEmailPrisma(email)
  }

  private static async getByEmailPrisma(email: string): Promise<User | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const user = await prismaDb.user.findUnique({
      where: { email },
      include: { school: true, teacher: true }
    })
    if (!user) return null
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      school: user.school ? {
        ...user.school,
        createdAt: user.school.createdAt.toISOString(),
        updatedAt: user.school.updatedAt.toISOString(),
      } : null,
      teacher: user.teacher ? {
        ...user.teacher,
        createdAt: user.teacher.createdAt.toISOString(),
        updatedAt: user.teacher.updatedAt.toISOString(),
      } : null,
    } as User
  }

  private static async getByEmailSQLite(email: string): Promise<User | null> {
    const conn = ConnectionManager
    const sql = `
      SELECT u.*,
        s.id as school_id,
        s.name as school_name,
        s.schoolType as school_schoolType,
        s.logo as school_logo,
        s.logo2 as school_logo2,
        s.council as school_council,
        s.region as school_region,
        s.district as school_district,
        s.ward as school_ward,
        s.headTeacherName as school_headTeacherName,
        s.registrationNo as school_registrationNo,
        s.phone as school_phone,
        t.name as teacher_name
      FROM User u
      LEFT JOIN School s ON u.schoolId = s.id
      LEFT JOIN Teacher t ON t.userId = u.id
      WHERE u.email = ?
    `
    const rows = await conn.query<Record<string, unknown>>(sql, [email])
    return rows.length > 0 ? this.mapRowToUser(rows[0]) : null
  }

  // Get user by username
  static async getByUsername(username: string): Promise<User | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByUsernameSQLite(username)
    }
    return this.getByUsernamePrisma(username)
  }

  private static async getByUsernamePrisma(username: string): Promise<User | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const user = await prismaDb.user.findUnique({
      where: { username },
      include: { school: true, teacher: true }
    })
    if (!user) return null
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      school: user.school ? {
        ...user.school,
        createdAt: user.school.createdAt.toISOString(),
        updatedAt: user.school.updatedAt.toISOString(),
      } : null,
      teacher: user.teacher ? {
        ...user.teacher,
        createdAt: user.teacher.createdAt.toISOString(),
        updatedAt: user.teacher.updatedAt.toISOString(),
      } : null,
    } as User
  }

  private static async getByUsernameSQLite(username: string): Promise<User | null> {
    const conn = ConnectionManager
    const sql = `
      SELECT u.*,
        s.id as school_id,
        s.name as school_name,
        s.schoolType as school_schoolType,
        s.logo as school_logo,
        s.logo2 as school_logo2,
        s.council as school_council,
        s.region as school_region,
        s.district as school_district,
        s.ward as school_ward,
        s.headTeacherName as school_headTeacherName,
        s.registrationNo as school_registrationNo,
        s.phone as school_phone,
        t.name as teacher_name
      FROM User u
      LEFT JOIN School s ON u.schoolId = s.id
      LEFT JOIN Teacher t ON t.userId = u.id
      WHERE u.username = ?
    `
    const rows = await conn.query<Record<string, unknown>>(sql, [username])
    return rows.length > 0 ? this.mapRowToUser(rows[0]) : null
  }

  // Create user
  static async create(data: CreateUserInput): Promise<User> {
    if (ConnectionManager.isMobile()) {
      return this.createSQLite(data)
    }
    return this.createPrisma(data)
  }

  private static async createPrisma(data: CreateUserInput): Promise<User> {
    // Validate required fields
    validateRequired(data as unknown as Record<string, unknown>, ['email', 'username', 'password', 'fullName'])
    validateEmail(data.email)
    validateLength(data.username, 'Username', 3, 50)
    validateLength(data.fullName, 'Full name', 2, 100)
    
    const { db: prismaDb } = await import('@/lib/db')
    const user = await prismaDb.user.create({
      data: {
        ...data,
        role: data.role || 'TEACHER',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: { school: true, teacher: true }
    })
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      school: user.school ? {
        ...user.school,
        createdAt: user.school.createdAt.toISOString(),
        updatedAt: user.school.updatedAt.toISOString(),
      } : null,
      teacher: user.teacher ? {
        ...user.teacher,
        createdAt: user.teacher.createdAt.toISOString(),
        updatedAt: user.teacher.updatedAt.toISOString(),
      } : null,
    } as User
  }

  private static async createSQLite(data: CreateUserInput): Promise<User> {
    // Validate required fields
    validateRequired(data as unknown as Record<string, unknown>, ['email', 'username', 'password', 'fullName'])
    validateEmail(data.email)
    validateLength(data.username, 'Username', 3, 50)
    validateLength(data.fullName, 'Full name', 2, 100)
    
    const conn = ConnectionManager
    const id = generateId()
    const now = new Date().toISOString()
    
    try {
      const sql = `
        INSERT INTO User (id, email, username, password, fullName, role, active, schoolId, schoolType, securityQuestion, securityAnswer, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      await conn.execute(sql, [
        id,
        data.email,
        data.username,
        data.password,
        data.fullName,
        data.role || 'TEACHER',
        1,
        data.schoolId || null,
        data.schoolType || null,
        data.securityQuestion || null,
        data.securityAnswer || null,
        now,
        now
      ])
      
      const user = await this.getById(id)
      if (!user) throw new Error('Failed to create user')
      return user
    } catch (error) {
      if (error instanceof Error && error.message?.includes('undefined')) {
        throw new Error('Database error: Please restart the app and try again.')
      }
      throw error
    }
  }

  // Update user
  static async update(id: string, data: UpdateUserInput): Promise<User> {
    if (ConnectionManager.isMobile()) {
      return this.updateSQLite(id, data)
    }
    return this.updatePrisma(id, data)
  }

  private static async updatePrisma(id: string, data: UpdateUserInput): Promise<User> {
    const { db: prismaDb } = await import('@/lib/db')
    const user = await prismaDb.user.update({
      where: { id },
      data,
      include: { school: true, teacher: true }
    })
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      school: user.school ? {
        ...user.school,
        createdAt: user.school.createdAt.toISOString(),
        updatedAt: user.school.updatedAt.toISOString(),
      } : null,
      teacher: user.teacher ? {
        ...user.teacher,
        createdAt: user.teacher.createdAt.toISOString(),
        updatedAt: user.teacher.updatedAt.toISOString(),
      } : null,
    } as User
  }

  private static async updateSQLite(id: string, data: UpdateUserInput): Promise<User> {
    const conn = ConnectionManager
    const now = new Date().toISOString()
    
    const existing = await this.getById(id)
    if (!existing) throw new Error('User not found')
    
    const fields: string[] = []
    const values: unknown[] = []
    
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email) }
    if (data.username !== undefined) { fields.push('username = ?'); values.push(data.username) }
    if (data.password !== undefined) { fields.push('password = ?'); values.push(data.password) }
    if (data.fullName !== undefined) { fields.push('fullName = ?'); values.push(data.fullName) }
    if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role) }
    if (data.schoolId !== undefined) { fields.push('schoolId = ?'); values.push(data.schoolId) }
    if (data.schoolType !== undefined) { fields.push('schoolType = ?'); values.push(data.schoolType) }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0) }
    if (data.securityQuestion !== undefined) { fields.push('securityQuestion = ?'); values.push(data.securityQuestion) }
    if (data.securityAnswer !== undefined) { fields.push('securityAnswer = ?'); values.push(data.securityAnswer) }
    fields.push('updatedAt = ?')
    values.push(now)
    values.push(id)
    const sql = `UPDATE User SET ${fields.join(', ')} WHERE id = ?`
    await conn.execute(sql, values)
    const user = await this.getById(id)
    if (!user) throw new Error('Failed to update user')
    return user
  }

  // Delete user
  static async delete(id: string): Promise<User> {
    if (ConnectionManager.isMobile()) {
      return this.deleteSQLite(id)
    }
    return this.deletePrisma(id)
  }

  private static async deletePrisma(id: string): Promise<User> {
    const { db: prismaDb } = await import('@/lib/db')
    const user = await prismaDb.user.delete({
      where: { id },
      include: { school: true, teacher: true }
    })
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      school: user.school ? {
        ...user.school,
        createdAt: user.school.createdAt.toISOString(),
        updatedAt: user.school.updatedAt.toISOString(),
      } : null,
      teacher: user.teacher ? {
        ...user.teacher,
        createdAt: user.teacher.createdAt.toISOString(),
        updatedAt: user.teacher.updatedAt.toISOString(),
      } : null,
    } as User
  }

  private static async deleteSQLite(id: string): Promise<User> {
    const conn = ConnectionManager
    
    const existing = await this.getById(id)
    if (!existing) throw new Error('User not found')
    
    await conn.execute('DELETE FROM User WHERE id = ?', [id])
    return existing
  }

  // Helper: Map database row to User object
  private static mapRowToUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      email: row.email as string,
      username: row.username as string,
      password: row.password as string,
      fullName: row.fullName as string,
      role: row.role as 'TEACHER' | 'ADMIN',
      active: Boolean(row.active),
      schoolId: row.schoolId as string | null,
      schoolType: row.schoolType as 'PRIMARY' | 'SECONDARY' | null,
      securityQuestion: row.securityQuestion as string | null,
      securityAnswer: row.securityAnswer as string | null,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      school: row.school_id ? {
        id: row.school_id as string,
        name: row.school_name as string,
        schoolType: (row.school_schoolType || row.schoolType || 'PRIMARY') as 'PRIMARY' | 'SECONDARY',
        logo: row.school_logo as string | null,
        logo2: row.school_logo2 as string | null,
        council: row.school_council as string | null,
        region: row.school_region as string | null,
        district: row.school_district as string | null,
        ward: row.school_ward as string | null,
        headTeacherName: row.school_headTeacherName as string | null,
        registrationNo: row.school_registrationNo as string | null,
        phone: row.school_phone as string | null,
      } : null,
      teacher: row.teacher_name ? { name: row.teacher_name as string } : null
    } as User
  }
}
