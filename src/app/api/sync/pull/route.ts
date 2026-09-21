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
  const changes = await db.syncChange.findMany({
    where: { schoolId: actor.schoolId, ...(resync ? {} : { sequence: { gt: cursorValue } }) },
    orderBy: { sequence: 'asc' },
    take: limit,
  })
  const visible = authorizedClasses
    ? changes.filter(change => {
        const classId = payloadClassId(change.payload)
        return Boolean(classId && authorizedClasses.has(classId))
      })
    : changes
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
