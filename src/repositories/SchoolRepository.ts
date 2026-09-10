import { ConnectionManager } from '@/services/database/ConnectionManager'
import { useAppStore } from '@/lib/store'
import type { Prisma } from '@prisma/client'
import { getDefaultGradingConfigs } from '@/modules/settings'
import { validateRequired, validateLength, generateId } from '@/modules/validation'
import type { School, SchoolType, GradingConfig } from '@/types'

export interface CreateSchoolInput {
  id?: string
  name: string
  schoolType: SchoolType
  logo?: string
  logo2?: string
  registrationNo?: string
  council?: string
  region?: string
  district?: string
  ward?: string
  phone?: string
  email?: string
  headTeacherName?: string
  headTeacherSign?: string
  headTeacherComments?: string
  classTeacherName?: string
  classTeacherShortName?: string
  classTeacherComments?: string
  ctGradeA_en?: string
  ctGradeB_en?: string
  ctGradeC_en?: string
  ctGradeD_en?: string
  ctGradeE_en?: string
  ctGradeA_sw?: string
  ctGradeB_sw?: string
  ctGradeC_sw?: string
  ctGradeD_sw?: string
  ctGradeE_sw?: string
  htGradeA_en?: string
  htGradeB_en?: string
  htGradeC_en?: string
  htGradeD_en?: string
  htGradeE_en?: string
  htGradeA_sw?: string
  htGradeB_sw?: string
  htGradeC_sw?: string
  htGradeD_sw?: string
  htGradeE_sw?: string
  academicYear?: string
  term?: string
}

export interface UpdateSchoolInput {
  id: string
  name?: string
  schoolType?: SchoolType
  logo?: string | null
  logo2?: string | null
  registrationNo?: string | null
  council?: string | null
  region?: string | null
  district?: string | null
  ward?: string | null
  phone?: string | null
  email?: string | null
  headTeacherName?: string | null
  headTeacherSign?: string | null
  headTeacherComments?: string | null
  classTeacherName?: string | null
  classTeacherShortName?: string | null
  classTeacherComments?: string | null
  ctGradeA_en?: string | null
  ctGradeB_en?: string | null
  ctGradeC_en?: string | null
  ctGradeD_en?: string | null
  ctGradeE_en?: string | null
  ctGradeA_sw?: string | null
  ctGradeB_sw?: string | null
  ctGradeC_sw?: string | null
  ctGradeD_sw?: string | null
  ctGradeE_sw?: string | null
  htGradeA_en?: string | null
  htGradeB_en?: string | null
  htGradeC_en?: string | null
  htGradeD_en?: string | null
  htGradeE_en?: string | null
  htGradeA_sw?: string | null
  htGradeB_sw?: string | null
  htGradeC_sw?: string | null
  htGradeD_sw?: string | null
  htGradeE_sw?: string | null
  academicYear?: string | null
  term?: string | null
}

export interface SchoolWithCounts extends School {
  studentCount: number
  classCount: number
  teacherCount: number
}

export class SchoolRepository {
  // Get all schools
  static async getAll(): Promise<School[]> {
    if (ConnectionManager.isMobile()) {
      return this.getAllSQLite()
    }
    return this.getAllPrisma()
  }

  private static async getAllPrisma(): Promise<School[]> {
    const { db: prismaDb } = await import('@/lib/db')
    const schools = await prismaDb.school.findMany({
      orderBy: { name: 'asc' },
    })
    return schools.map(s => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() }))
  }

  private static async getAllSQLite(): Promise<School[]> {
    const conn = ConnectionManager
    // If running in mobile/offline mode and a user is logged in, only return that user's school
    const currentUser = useAppStore.getState().currentUser
    if (currentUser?.schoolId) {
      const rows = await conn.query<School>('SELECT * FROM School WHERE id = ? ORDER BY name ASC', [currentUser.schoolId])
      return rows
    }
    const rows = await conn.query<School>('SELECT * FROM School ORDER BY name ASC')
    return rows
  }

  // Get school by ID
  static async getById(id: string): Promise<School | null> {
    if (ConnectionManager.isMobile()) {
      return this.getByIdSQLite(id)
    }
    return this.getByIdPrisma(id)
  }

  private static async getByIdPrisma(id: string): Promise<School | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const school = await prismaDb.school.findUnique({
      where: { id },
    })
    if (!school) return null
    return { ...school, createdAt: school.createdAt.toISOString(), updatedAt: school.updatedAt.toISOString() }
  }

  private static async getByIdSQLite(id: string): Promise<School | null> {
    const conn = ConnectionManager
    const rows = await conn.query<School>('SELECT * FROM School WHERE id = ?', [id])
    return rows[0] || null
  }

  // Get school with statistics
  static async getWithCounts(id: string): Promise<SchoolWithCounts | null> {
    if (ConnectionManager.isMobile()) {
      return this.getWithCountsSQLite(id)
    }
    return this.getWithCountsPrisma(id)
  }

  private static async getWithCountsPrisma(id: string): Promise<SchoolWithCounts | null> {
    const { db: prismaDb } = await import('@/lib/db')
    const school = await prismaDb.school.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            classes: true,
            teachers: true,
          }
        }
      }
    })

    if (!school) return null

    const { _count, ...schoolData } = school
    return {
      ...schoolData,
      createdAt: school.createdAt.toISOString(),
      updatedAt: school.updatedAt.toISOString(),
      studentCount: _count.students,
      classCount: _count.classes,
      teacherCount: _count.teachers,
    } as SchoolWithCounts
  }

  private static async getWithCountsSQLite(id: string): Promise<SchoolWithCounts | null> {
    const conn = ConnectionManager
    const rows = await conn.query<School & { studentCount: number; classCount: number; teacherCount: number }>(`
      SELECT s.*,
        (SELECT COUNT(*) FROM Student WHERE schoolId = s.id) as studentCount,
        (SELECT COUNT(*) FROM Class WHERE schoolId = s.id) as classCount,
        (SELECT COUNT(*) FROM Teacher WHERE schoolId = s.id) as teacherCount
      FROM School s
      WHERE s.id = ?
    `, [id])

    if (rows.length === 0) return null
    return rows[0]
  }

  // Create school
  static async create(input: CreateSchoolInput): Promise<School> {
    if (ConnectionManager.isMobile()) {
      return this.createSQLite(input)
    }
    return this.createPrisma(input)
  }

  private static async createPrisma(input: CreateSchoolInput): Promise<School> {
    // Validate required fields
    validateRequired(input as unknown as Record<string, unknown>, ['name', 'schoolType'])
    validateLength(input.name, 'School name', 2, 100)
    
    const { db: prismaDb } = await import('@/lib/db')
    const data: Prisma.SchoolCreateInput = {
        id: input.id,
        name: input.name,
        schoolType: input.schoolType,
        logo: input.logo,
        logo2: input.logo2,
        registrationNo: input.registrationNo,
        council: input.council,
        region: input.region,
        district: input.district,
        ward: input.ward,
        phone: input.phone,
        email: input.email,
        headTeacherName: input.headTeacherName,
        headTeacherSign: input.headTeacherSign,
        headTeacherComments: input.headTeacherComments,
        classTeacherName: input.classTeacherName,
        classTeacherShortName: input.classTeacherShortName,
        classTeacherComments: input.classTeacherComments,
        ctGradeA_en: input.ctGradeA_en,
        ctGradeB_en: input.ctGradeB_en,
        ctGradeC_en: input.ctGradeC_en,
        ctGradeD_en: input.ctGradeD_en,
        ctGradeE_en: input.ctGradeE_en,
        ctGradeA_sw: input.ctGradeA_sw,
        ctGradeB_sw: input.ctGradeB_sw,
        ctGradeC_sw: input.ctGradeC_sw,
        ctGradeD_sw: input.ctGradeD_sw,
        ctGradeE_sw: input.ctGradeE_sw,
        htGradeA_en: input.htGradeA_en,
        htGradeB_en: input.htGradeB_en,
        htGradeC_en: input.htGradeC_en,
        htGradeD_en: input.htGradeD_en,
        htGradeE_en: input.htGradeE_en,
        htGradeA_sw: input.htGradeA_sw,
        htGradeB_sw: input.htGradeB_sw,
        htGradeC_sw: input.htGradeC_sw,
        htGradeD_sw: input.htGradeD_sw,
        htGradeE_sw: input.htGradeE_sw,
        academicYear: input.academicYear,
        term: input.term,
      }

    const school = await prismaDb.school.create({
      data,
    })
    return { ...school, createdAt: school.createdAt.toISOString(), updatedAt: school.updatedAt.toISOString() }
  }

  private static async createSQLite(input: CreateSchoolInput): Promise<School> {
    // Validate required fields
    validateRequired(input as unknown as Record<string, unknown>, ['name', 'schoolType'])
    validateLength(input.name, 'School name', 2, 100)
    
    const conn = ConnectionManager
    const id = input.id || generateId()
    const now = new Date().toISOString()

    await conn.execute(`
      INSERT INTO School (
        id, name, schoolType, logo, logo2, registrationNo, council,
        region, district, ward, phone, email, headTeacherName, headTeacherSign,
        headTeacherComments, classTeacherName, classTeacherShortName, classTeacherComments,
        ctGradeA_en, ctGradeB_en, ctGradeC_en, ctGradeD_en, ctGradeE_en,
        ctGradeA_sw, ctGradeB_sw, ctGradeC_sw, ctGradeD_sw, ctGradeE_sw,
        htGradeA_en, htGradeB_en, htGradeC_en, htGradeD_en, htGradeE_en,
        htGradeA_sw, htGradeB_sw, htGradeC_sw, htGradeD_sw, htGradeE_sw,
        academicYear, term, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, input.name, input.schoolType, input.logo || null,
      input.logo2 || null, input.registrationNo || null,
      input.council || null, input.region || null,
      input.district || null, input.ward || null,
      input.phone || null, input.email || null,
      input.headTeacherName || null, input.headTeacherSign || null,
      input.headTeacherComments || null, input.classTeacherName || null,
      input.classTeacherShortName || null, input.classTeacherComments || null,
      input.ctGradeA_en || null, input.ctGradeB_en || null, input.ctGradeC_en || null,
      input.ctGradeD_en || null, input.ctGradeE_en || null,
      input.ctGradeA_sw || null, input.ctGradeB_sw || null, input.ctGradeC_sw || null,
      input.ctGradeD_sw || null, input.ctGradeE_sw || null,
      input.htGradeA_en || null, input.htGradeB_en || null, input.htGradeC_en || null,
      input.htGradeD_en || null, input.htGradeE_en || null,
      input.htGradeA_sw || null, input.htGradeB_sw || null, input.htGradeC_sw || null,
      input.htGradeD_sw || null, input.htGradeE_sw || null,
      input.academicYear || null, input.term || null,
      now, now
    ])

    const school = await this.getById(id)
    if (!school) throw new Error('Failed to create school')
    return school
  }

  // Update school
  static async update(input: UpdateSchoolInput): Promise<School> {
    if (ConnectionManager.isMobile()) {
      return this.updateSQLite(input)
    }
    return this.updatePrisma(input)
  }

  private static async updatePrisma(input: UpdateSchoolInput): Promise<School> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.school.findUnique({ where: { id: input.id } })
    if (!existing) {
      throw new Error('School not found')
    }

    const data: Prisma.SchoolUpdateInput = {
        name: input.name ?? undefined,
        schoolType: input.schoolType ?? undefined,
        logo: input.logo !== undefined ? input.logo : undefined,
        logo2: input.logo2 !== undefined ? input.logo2 : undefined,
        registrationNo: input.registrationNo !== undefined ? input.registrationNo : undefined,
        council: input.council !== undefined ? input.council : undefined,
        region: input.region !== undefined ? input.region : undefined,
        district: input.district !== undefined ? input.district : undefined,
        ward: input.ward !== undefined ? input.ward : undefined,
        phone: input.phone !== undefined ? input.phone : undefined,
        email: input.email !== undefined ? input.email : undefined,
        headTeacherName: input.headTeacherName !== undefined ? input.headTeacherName : undefined,
        headTeacherSign: input.headTeacherSign !== undefined ? input.headTeacherSign : undefined,
        headTeacherComments: input.headTeacherComments !== undefined ? input.headTeacherComments : undefined,
        classTeacherName: input.classTeacherName !== undefined ? input.classTeacherName : undefined,
        classTeacherShortName: input.classTeacherShortName !== undefined ? input.classTeacherShortName : undefined,
        classTeacherComments: input.classTeacherComments !== undefined ? input.classTeacherComments : undefined,
        ctGradeA_en: input.ctGradeA_en !== undefined ? input.ctGradeA_en : undefined,
        ctGradeB_en: input.ctGradeB_en !== undefined ? input.ctGradeB_en : undefined,
        ctGradeC_en: input.ctGradeC_en !== undefined ? input.ctGradeC_en : undefined,
        ctGradeD_en: input.ctGradeD_en !== undefined ? input.ctGradeD_en : undefined,
        ctGradeE_en: input.ctGradeE_en !== undefined ? input.ctGradeE_en : undefined,
        ctGradeA_sw: input.ctGradeA_sw !== undefined ? input.ctGradeA_sw : undefined,
        ctGradeB_sw: input.ctGradeB_sw !== undefined ? input.ctGradeB_sw : undefined,
        ctGradeC_sw: input.ctGradeC_sw !== undefined ? input.ctGradeC_sw : undefined,
        ctGradeD_sw: input.ctGradeD_sw !== undefined ? input.ctGradeD_sw : undefined,
        ctGradeE_sw: input.ctGradeE_sw !== undefined ? input.ctGradeE_sw : undefined,
        htGradeA_en: input.htGradeA_en !== undefined ? input.htGradeA_en : undefined,
        htGradeB_en: input.htGradeB_en !== undefined ? input.htGradeB_en : undefined,
        htGradeC_en: input.htGradeC_en !== undefined ? input.htGradeC_en : undefined,
        htGradeD_en: input.htGradeD_en !== undefined ? input.htGradeD_en : undefined,
        htGradeE_en: input.htGradeE_en !== undefined ? input.htGradeE_en : undefined,
        htGradeA_sw: input.htGradeA_sw !== undefined ? input.htGradeA_sw : undefined,
        htGradeB_sw: input.htGradeB_sw !== undefined ? input.htGradeB_sw : undefined,
        htGradeC_sw: input.htGradeC_sw !== undefined ? input.htGradeC_sw : undefined,
        htGradeD_sw: input.htGradeD_sw !== undefined ? input.htGradeD_sw : undefined,
        htGradeE_sw: input.htGradeE_sw !== undefined ? input.htGradeE_sw : undefined,
        academicYear: input.academicYear !== undefined ? input.academicYear : undefined,
        term: input.term !== undefined ? input.term : undefined,
      }

    const school = await prismaDb.school.update({
      where: { id: input.id },
      data,
    })
    return { ...school, createdAt: school.createdAt.toISOString(), updatedAt: school.updatedAt.toISOString() }
  }

  private static async updateSQLite(input: UpdateSchoolInput): Promise<School> {
    const conn = ConnectionManager
    
    const existing = await this.getById(input.id)
    if (!existing) {
      throw new Error('School not found')
    }

    const updates: string[] = []
    const params: unknown[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      params.push(input.name)
    }
    if (input.schoolType !== undefined) {
      updates.push('schoolType = ?')
      params.push(input.schoolType)
    }
    if (input.logo !== undefined) {
      updates.push('logo = ?')
      params.push(input.logo)
    }
    if (input.logo2 !== undefined) {
      updates.push('logo2 = ?')
      params.push(input.logo2)
    }
    if (input.registrationNo !== undefined) {
      updates.push('registrationNo = ?')
      params.push(input.registrationNo)
    }
    if (input.council !== undefined) {
      updates.push('council = ?')
      params.push(input.council)
    }
    if (input.region !== undefined) {
      updates.push('region = ?')
      params.push(input.region)
    }
    if (input.district !== undefined) {
      updates.push('district = ?')
      params.push(input.district)
    }
    if (input.ward !== undefined) {
      updates.push('ward = ?')
      params.push(input.ward)
    }
    if (input.phone !== undefined) {
      updates.push('phone = ?')
      params.push(input.phone)
    }
    if (input.email !== undefined) {
      updates.push('email = ?')
      params.push(input.email)
    }
    if (input.headTeacherName !== undefined) {
      updates.push('headTeacherName = ?')
      params.push(input.headTeacherName)
    }
    if (input.headTeacherSign !== undefined) {
      updates.push('headTeacherSign = ?')
      params.push(input.headTeacherSign)
    }
    if (input.headTeacherComments !== undefined) {
      updates.push('headTeacherComments = ?')
      params.push(input.headTeacherComments)
    }
    if (input.classTeacherName !== undefined) {
      updates.push('classTeacherName = ?')
      params.push(input.classTeacherName)
    }
    if (input.classTeacherShortName !== undefined) {
      updates.push('classTeacherShortName = ?')
      params.push(input.classTeacherShortName)
    }
    if (input.classTeacherComments !== undefined) {
      updates.push('classTeacherComments = ?')
      params.push(input.classTeacherComments)
    }
    if (input.ctGradeA_en !== undefined) {
      updates.push('ctGradeA_en = ?')
      params.push(input.ctGradeA_en)
    }
    if (input.ctGradeB_en !== undefined) {
      updates.push('ctGradeB_en = ?')
      params.push(input.ctGradeB_en)
    }
    if (input.ctGradeC_en !== undefined) {
      updates.push('ctGradeC_en = ?')
      params.push(input.ctGradeC_en)
    }
    if (input.ctGradeD_en !== undefined) {
      updates.push('ctGradeD_en = ?')
      params.push(input.ctGradeD_en)
    }
    if (input.ctGradeE_en !== undefined) {
      updates.push('ctGradeE_en = ?')
      params.push(input.ctGradeE_en)
    }
    if (input.ctGradeA_sw !== undefined) {
      updates.push('ctGradeA_sw = ?')
      params.push(input.ctGradeA_sw)
    }
    if (input.ctGradeB_sw !== undefined) {
      updates.push('ctGradeB_sw = ?')
      params.push(input.ctGradeB_sw)
    }
    if (input.ctGradeC_sw !== undefined) {
      updates.push('ctGradeC_sw = ?')
      params.push(input.ctGradeC_sw)
    }
    if (input.ctGradeD_sw !== undefined) {
      updates.push('ctGradeD_sw = ?')
      params.push(input.ctGradeD_sw)
    }
    if (input.ctGradeE_sw !== undefined) {
      updates.push('ctGradeE_sw = ?')
      params.push(input.ctGradeE_sw)
    }
    if (input.htGradeA_en !== undefined) {
      updates.push('htGradeA_en = ?')
      params.push(input.htGradeA_en)
    }
    if (input.htGradeB_en !== undefined) {
      updates.push('htGradeB_en = ?')
      params.push(input.htGradeB_en)
    }
    if (input.htGradeC_en !== undefined) {
      updates.push('htGradeC_en = ?')
      params.push(input.htGradeC_en)
    }
    if (input.htGradeD_en !== undefined) {
      updates.push('htGradeD_en = ?')
      params.push(input.htGradeD_en)
    }
    if (input.htGradeE_en !== undefined) {
      updates.push('htGradeE_en = ?')
      params.push(input.htGradeE_en)
    }
    if (input.htGradeA_sw !== undefined) {
      updates.push('htGradeA_sw = ?')
      params.push(input.htGradeA_sw)
    }
    if (input.htGradeB_sw !== undefined) {
      updates.push('htGradeB_sw = ?')
      params.push(input.htGradeB_sw)
    }
    if (input.htGradeC_sw !== undefined) {
      updates.push('htGradeC_sw = ?')
      params.push(input.htGradeC_sw)
    }
    if (input.htGradeD_sw !== undefined) {
      updates.push('htGradeD_sw = ?')
      params.push(input.htGradeD_sw)
    }
    if (input.htGradeE_sw !== undefined) {
      updates.push('htGradeE_sw = ?')
      params.push(input.htGradeE_sw)
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
      `UPDATE School SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    const school = await this.getById(input.id)
    if (!school) throw new Error('Failed to update school')
    return school
  }

  // Delete school
  static async delete(id: string): Promise<void> {
    if (ConnectionManager.isMobile()) {
      return this.deleteSQLite(id)
    }
    return this.deletePrisma(id)
  }

  private static async deletePrisma(id: string): Promise<void> {
    const { db: prismaDb } = await import('@/lib/db')
    const existing = await prismaDb.school.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('School not found')
    }

    await prismaDb.school.delete({ where: { id } })
  }

  private static async deleteSQLite(id: string): Promise<void> {
    const conn = ConnectionManager
    
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error('School not found')
    }

    await conn.execute('DELETE FROM School WHERE id = ?', [id])
  }

  // Get grading configs for school
  static async getGradingConfigs(schoolId: string, schoolType?: SchoolType): Promise<GradingConfig[]> {
    if (ConnectionManager.isMobile()) {
      return this.getGradingConfigsSQLite(schoolId, schoolType)
    }
    return this.getGradingConfigsPrisma(schoolId, schoolType)
  }

  private static async getGradingConfigsPrisma(schoolId: string, schoolType?: SchoolType): Promise<GradingConfig[]> {
    const where: Record<string, unknown> = { schoolId }
    if (schoolType) where.schoolType = schoolType

    const { db: prismaDb } = await import('@/lib/db')
    const configs = await prismaDb.gradingConfig.findMany({
      where,
      orderBy: [{ schoolType: 'asc' }, { minMark: 'desc' }],
    })
    return configs.map(c => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })) as GradingConfig[]
  }

  private static async getGradingConfigsSQLite(schoolId: string, schoolType?: SchoolType): Promise<GradingConfig[]> {
    const conn = ConnectionManager
    let sql = 'SELECT * FROM GradingConfig WHERE schoolId = ?'
    const params: unknown[] = [schoolId]

    if (schoolType) {
      sql += ' AND schoolType = ?'
      params.push(schoolType)
    }

    sql += ' ORDER BY schoolType ASC, minMark DESC'

    return await conn.query<GradingConfig>(sql, params)
  }

  // Create grading config
  static async createGradingConfig(input: {
    schoolType: SchoolType
    grade: string
    minMark: number
    maxMark: number
    remarks: string
    points?: number
    division?: string
    schoolId: string
  }): Promise<GradingConfig> {
    if (ConnectionManager.isMobile()) {
      return this.createGradingConfigSQLite(input)
    }
    return this.createGradingConfigPrisma(input)
  }

  private static async createGradingConfigPrisma(input: typeof SchoolRepository.createGradingConfig extends (arg: infer T) => unknown ? T : never): Promise<GradingConfig> {
    const { db: prismaDb } = await import('@/lib/db')
    const config = await prismaDb.gradingConfig.create({
      data: {
        schoolType: input.schoolType,
        grade: input.grade,
        minMark: input.minMark,
        maxMark: input.maxMark,
        remarks: input.remarks,
        points: input.points,
        division: input.division,
        schoolId: input.schoolId,
      },
    })
    return { ...config, createdAt: config.createdAt.toISOString(), updatedAt: config.updatedAt.toISOString() } as GradingConfig
  }

  private static async createGradingConfigSQLite(input: typeof SchoolRepository.createGradingConfig extends (arg: infer T) => unknown ? T : never): Promise<GradingConfig> {
    const conn = ConnectionManager
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await conn.execute(`
      INSERT INTO GradingConfig (
        id, schoolType, grade, minMark, maxMark, remarks, points, division, schoolId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, input.schoolType, input.grade, input.minMark,
      input.maxMark, input.remarks, input.points || null,
      input.division || null, input.schoolId, now, now
    ])

    const configs = await conn.query<GradingConfig>('SELECT * FROM GradingConfig WHERE id = ?', [id])
    if (configs.length === 0) throw new Error('Failed to create grading config')
    return configs[0]
  }

  static async updateGradingConfig(input: {
    id: string
    grade?: string
    minMark?: number
    maxMark?: number
    remarks?: string
    points?: number | null
    division?: string | null
  }): Promise<GradingConfig> {
    if (ConnectionManager.isMobile()) {
      return this.updateGradingConfigSQLite(input)
    }
    return this.updateGradingConfigPrisma(input)
  }

  private static async updateGradingConfigPrisma(input: {
    id: string
    grade?: string
    minMark?: number
    maxMark?: number
    remarks?: string
    points?: number | null
    division?: string | null
  }): Promise<GradingConfig> {
    const { db: prismaDb } = await import('@/lib/db')
    const config = await prismaDb.gradingConfig.update({
      where: { id: input.id },
      data: {
        grade: input.grade ?? undefined,
        minMark: input.minMark ?? undefined,
        maxMark: input.maxMark ?? undefined,
        remarks: input.remarks ?? undefined,
        points: input.points !== undefined ? input.points : undefined,
        division: input.division !== undefined ? input.division : undefined,
      },
    })
    return { ...config, createdAt: config.createdAt.toISOString(), updatedAt: config.updatedAt.toISOString() } as GradingConfig
  }

  private static async updateGradingConfigSQLite(input: {
    id: string
    grade?: string
    minMark?: number
    maxMark?: number
    remarks?: string
    points?: number | null
    division?: string | null
  }): Promise<GradingConfig> {
    const conn = ConnectionManager
    const updates: string[] = []
    const params: unknown[] = []

    if (input.grade !== undefined) {
      updates.push('grade = ?')
      params.push(input.grade)
    }
    if (input.minMark !== undefined) {
      updates.push('minMark = ?')
      params.push(input.minMark)
    }
    if (input.maxMark !== undefined) {
      updates.push('maxMark = ?')
      params.push(input.maxMark)
    }
    if (input.remarks !== undefined) {
      updates.push('remarks = ?')
      params.push(input.remarks)
    }
    if (input.points !== undefined) {
      updates.push('points = ?')
      params.push(input.points)
    }
    if (input.division !== undefined) {
      updates.push('division = ?')
      params.push(input.division)
    }

    updates.push('updatedAt = ?')
    params.push(new Date().toISOString())
    params.push(input.id)

    await conn.execute(
      `UPDATE GradingConfig SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    const configs = await conn.query<GradingConfig>('SELECT * FROM GradingConfig WHERE id = ?', [input.id])
    if (configs.length === 0) {
      throw new Error('Grading config not found')
    }
    return configs[0]
  }

  // Delete all grading configs for school
  static async deleteGradingConfigs(schoolId: string, schoolType?: SchoolType): Promise<void> {
    if (ConnectionManager.isMobile()) {
      return this.deleteGradingConfigsSQLite(schoolId, schoolType)
    }
    return this.deleteGradingConfigsPrisma(schoolId, schoolType)
  }

  private static async deleteGradingConfigsPrisma(schoolId: string, schoolType?: SchoolType): Promise<void> {
    const { db: prismaDb } = await import('@/lib/db')
    const where: Record<string, unknown> = { schoolId }
    if (schoolType) where.schoolType = schoolType
    await prismaDb.gradingConfig.deleteMany({ where })
  }

  private static async deleteGradingConfigsSQLite(schoolId: string, schoolType?: SchoolType): Promise<void> {
    const conn = ConnectionManager
    let sql = 'DELETE FROM GradingConfig WHERE schoolId = ?'
    const params: unknown[] = [schoolId]

    if (schoolType) {
      sql += ' AND schoolType = ?'
      params.push(schoolType)
    }

    await conn.execute(sql, params)
  }

  // Seed default grading configs
  static async seedGradingConfigs(schoolId: string, schoolType: SchoolType): Promise<void> {
    const defaultConfigs = getDefaultGradingConfigs(schoolType)

    // Delete existing configs for this school type
    await this.deleteGradingConfigs(schoolId, schoolType)

    // Create new configs
    for (const config of defaultConfigs) {
      await this.createGradingConfig({
        schoolType: config.schoolType,
        grade: config.grade,
        minMark: config.minMark,
        maxMark: config.maxMark,
        remarks: config.remarks,
        points: config.points ?? undefined,
        division: config.division ?? undefined,
        schoolId,
      })
    }
  }

}
