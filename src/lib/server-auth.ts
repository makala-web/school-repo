import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'shulea_session'
const SESSION_DAYS = 30

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createAuthSession(userId: string, response: NextResponse) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.authSession.create({ data: { tokenHash: hashToken(token), userId, expiresAt } })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  })
}

export async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.authSession.findFirst({
    where: { tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  })
  return session?.user?.active ? session.user : null
}

/**
 * Academic access is derived from the authenticated session and database
 * assignments. Client-supplied schoolId/classId values are never sufficient.
 */
export async function canAccessClass(
  actor: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>,
  classId: string,
  options: { allowSubjectAssignment?: boolean } = {},
) {
  const classRecord = await db.class.findUnique({
    where: { id: classId },
    select: { schoolId: true },
  })
  if (!classRecord) return false
  if (actor.role === 'SUPER_ADMIN') return true
  if (!actor.schoolId || actor.schoolId !== classRecord.schoolId) return false
  // Demo accounts are read-only previews and may inspect every class in their
  // isolated demo school. Mutation routes still reject them separately.
  if (actor.isDemoUser) return true
  if (actor.role === 'SCHOOL_ADMIN') return true
  if (actor.role !== 'TEACHER') return false

  const teacher = await db.teacher.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  })
  if (!teacher) return false

  const classTeacherAssignment = await db.classTeacherAssignment.findFirst({
    where: { teacherId: teacher.id, classId, schoolId: actor.schoolId, status: 'ACTIVE' },
    select: { id: true },
  })
  if (classTeacherAssignment) return true
  if (!options.allowSubjectAssignment) return false

  const subjectAssignment = await db.teacherSubject.findFirst({
    where: { teacherId: teacher.id, classId },
    select: { id: true },
  })
  return Boolean(subjectAssignment)
}

export async function getAuthorizedClassIds(
  actor: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>,
  options: { allowSubjectAssignment?: boolean } = {},
) {
  if (actor.role === 'SUPER_ADMIN' || actor.role === 'SCHOOL_ADMIN') return null
  if (actor.role !== 'TEACHER' || !actor.schoolId) return []
  if (actor.isDemoUser) return null

  const teacher = await db.teacher.findUnique({ where: { userId: actor.id }, select: { id: true } })
  if (!teacher) return []
  const assignments = await db.classTeacherAssignment.findMany({
    where: { teacherId: teacher.id, schoolId: actor.schoolId, status: 'ACTIVE' },
    select: { classId: true },
  })
  const classIds = assignments.map(item => item.classId)
  if (options.allowSubjectAssignment) {
    const subjectAssignments = await db.teacherSubject.findMany({
      where: { teacherId: teacher.id },
      select: { classId: true },
    })
    classIds.push(...subjectAssignments.map(item => item.classId))
  }
  return [...new Set(classIds)]
}

export async function revokeAuthSession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (token) await db.authSession.updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } })
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, expires: new Date(0), path: '/' })
}

export async function rejectDemoMutation(request: NextRequest) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return null
  const user = await getAuthenticatedUser(request)
  if (user?.isDemoUser) return NextResponse.json({ error: 'Demo mode is read-only' }, { status: 403 })
  return null
}
