import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthenticatedUser, getAuthorizedClassIds } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

function payloadClassId(payload: string | null) {
  if (!payload) return null
  try {
    const value = JSON.parse(payload) as Record<string, unknown>
    for (const key of ['classId', 'class_id']) if (typeof value[key] === 'string') return value[key] as string
    return null
  } catch { return null }
}

export async function GET(request: NextRequest) {
  const actor = await getAuthenticatedUser(request)
  if (!actor || actor.role === 'SUPER_ADMIN' || !actor.schoolId) {
    return NextResponse.json({ error: 'Academic account required' }, { status: 403 })
  }

  const cursorValue = Number(request.nextUrl.searchParams.get('cursor') || '0')
  const limitValue = Number(request.nextUrl.searchParams.get('limit') || '100')
  if (!Number.isInteger(cursorValue) || cursorValue < 0) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
  const limit = Math.min(Math.max(Number.isInteger(limitValue) ? limitValue : 100, 1), 250)
  const resync = request.nextUrl.searchParams.get('resync') === '1'

  const authorizedClasses = actor.role === 'TEACHER' ? new Set(await getAuthorizedClassIds(actor, { allowSubjectAssignment: true })) : null
  const ownTeacher = actor.role === 'TEACHER'
    ? await db.teacher.findUnique({ where: { userId: actor.id }, select: { id: true } })
    : null
  const ownAssignments = ownTeacher ? await db.teacherSubject.findMany({ where: { teacherId: ownTeacher.id }, select: { classId: true, subjectId: true } }) : []
  const allowedPairs = new Set(ownAssignments.map(item => `${item.classId}:${item.subjectId}`))
  const allowedSubjectIds = new Set(ownAssignments.map(item => item.subjectId))
  const changes = await db.syncChange.findMany({
    where: { schoolId: actor.schoolId, ...(resync ? {} : { sequence: { gt: cursorValue } }) },
    orderBy: { sequence: 'asc' },
    take: limit,
  })
  const visible = authorizedClasses ? (await Promise.all(changes.map(async change => {
    const payload = change.payload ? JSON.parse(change.payload) as Record<string, unknown> : null
    if (change.entityType === 'TEACHER_SUBJECT') {
      if (payload) return payload.teacherId === ownTeacher?.id
      const prior = await db.syncChange.findFirst({ where: { schoolId: actor.schoolId!, entityType: 'TEACHER_SUBJECT', entityId: change.entityId, sequence: { lt: change.sequence }, payload: { not: null } }, orderBy: { sequence: 'desc' }, select: { payload: true } })
      return Boolean(prior?.payload && (JSON.parse(prior.payload) as Record<string, unknown>).teacherId === ownTeacher?.id)
    }
    if (change.entityType === 'MARK') {
      const classSubjectId = payload?.classSubjectId
      if (typeof classSubjectId !== 'string') return false
      const classSubject = await db.classSubject.findUnique({ where: { id: classSubjectId }, select: { classId: true, subjectId: true } })
      return Boolean(classSubject && allowedPairs.has(`${classSubject.classId}:${classSubject.subjectId}`))
    }
    if (change.entityType === 'CLASS_SUBJECT') {
      return typeof payload?.classId === 'string' && typeof payload?.subjectId === 'string' && allowedPairs.has(`${payload.classId}:${payload.subjectId}`)
    }
    if (change.entityType === 'SUBJECT') return allowedSubjectIds.has(change.entityId)
    if (change.entityType === 'CLASS') return authorizedClasses.has(change.entityId)
    if (change.entityType === 'TEACHER') return change.entityId === ownTeacher?.id
    if (change.entityType === 'CLASS_TEACHER_ASSIGNMENT') return payload?.teacherId === ownTeacher?.id
    const classId = payloadClassId(change.payload)
    return Boolean(classId && authorizedClasses.has(classId))
  }))).flatMap((include, index) => include ? [changes[index]] : []) : changes
  const nextCursor = changes.length ? changes[changes.length - 1].sequence : cursorValue

  return NextResponse.json({
    changes: visible.map(change => ({
      sequence: change.sequence,
      entityType: change.entityType,
      entityId: change.entityId,
      action: change.action,
      version: change.version,
      operationId: change.operationId,
      payload: change.payload ? JSON.parse(change.payload) : null,
      deletedAt: change.deletedAt,
      createdAt: change.createdAt,
    })),
    cursor: cursorValue,
    nextCursor,
    hasMore: changes.length === limit,
    authorizedClassIds: authorizedClasses ? [...authorizedClasses] : null,
  })
}
