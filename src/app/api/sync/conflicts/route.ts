import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const actor = await getAuthenticatedUser(request)
  if (!actor || actor.role !== 'SCHOOL_ADMIN' || !actor.schoolId) return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
  const conflicts = await db.syncConflict.findMany({ where: { schoolId: actor.schoolId, resolution: 'PENDING' }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ conflicts })
}

export async function POST(request: NextRequest) {
  const actor = await getAuthenticatedUser(request)
  if (!actor || actor.role !== 'SCHOOL_ADMIN' || !actor.schoolId) return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
  let body: { id?: string; resolution?: 'SERVER_WON' | 'CLIENT_WON' }
  try { body = await request.json() as typeof body } catch { return NextResponse.json({ error: 'Malformed conflict resolution' }, { status: 400 }) }
  if (!body.id || !body.resolution || !['SERVER_WON', 'CLIENT_WON'].includes(body.resolution)) return NextResponse.json({ error: 'Conflict ID and valid resolution are required' }, { status: 400 })
  const conflict = await db.syncConflict.findFirst({ where: { id: body.id, schoolId: actor.schoolId, resolution: 'PENDING' } })
  if (!conflict) return NextResponse.json({ error: 'Conflict not found' }, { status: 404 })
  await db.$transaction([
    db.syncConflict.update({ where: { id: conflict.id }, data: { resolution: body.resolution, resolvedAt: new Date(), resolvedBy: actor.id } }),
    db.syncOperation.updateMany({ where: { schoolId: actor.schoolId, operationId: conflict.operationId }, data: { status: body.resolution === 'SERVER_WON' ? 'PROCESSED' : 'FAILED', error: body.resolution === 'SERVER_WON' ? null : 'Client resolution requires a fresh authorized mutation' } }),
  ])
  return NextResponse.json({ success: true, resolution: body.resolution })
}
