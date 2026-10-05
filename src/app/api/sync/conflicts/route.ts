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
  if (body.resolution === 'CLIENT_WON') {
    if (conflict.entityType !== 'MARK') return NextResponse.json({ error: 'Client-wins resolution is only supported for marks; choose server value for this record.' }, { status: 422 })
    let local: Record<string, unknown>
    try {
      const parsed = JSON.parse(conflict.clientPayload) as Record<string, unknown>
      local = parsed.mark as Record<string, unknown>
      if (!local || typeof local.studentId !== 'string' || typeof local.classSubjectId !== 'string' || typeof local.examId !== 'string' || typeof local.marks !== 'number') throw new Error('invalid')
    } catch {
      return NextResponse.json({ error: 'Stored client mark cannot be resolved safely' }, { status: 422 })
    }
    const current = await db.marksEntry.findUnique({ where: { id: conflict.entityId } })
    if (!current) return NextResponse.json({ error: 'Server mark was removed; use server resolution and re-enter the mark' }, { status: 409 })
    const classSubject = await db.classSubject.findUnique({ where: { id: String(local.classSubjectId) }, include: { class: { select: { schoolId: true, schoolType: true } } } })
    const student = await db.student.findUnique({ where: { id: String(local.studentId) }, select: { schoolId: true, classId: true } })
    const exam = await db.exam.findUnique({ where: { id: String(local.examId) }, select: { schoolId: true, classId: true } })
    if (!classSubject || !student || !exam || classSubject.class.schoolId !== actor.schoolId || student.schoolId !== actor.schoolId || exam.schoolId !== actor.schoolId || student.classId !== classSubject.classId || exam.classId !== classSubject.classId || (classSubject.class.schoolType === 'PRIMARY' ? Number(local.marks) > 50 : Number(local.marks) > 100) || Number(local.marks) < 0) {
      return NextResponse.json({ error: 'Client mark no longer matches authorized school/class/student/exam data or mark range' }, { status: 422 })
    }
    const result = await db.$transaction(async tx => {
      const mark = await tx.marksEntry.update({ where: { id: current.id }, data: { marks: Number(local.marks), grade: typeof local.grade === 'string' ? local.grade : current.grade, remarks: typeof local.remarks === 'string' ? local.remarks : current.remarks } })
      const previous = await tx.syncChange.findFirst({ where: { schoolId: actor.schoolId!, entityType: 'MARK', entityId: mark.id }, orderBy: { sequence: 'desc' }, select: { version: true } })
      const sequence = await tx.syncSequence.upsert({ where: { schoolId: actor.schoolId! }, create: { schoolId: actor.schoolId!, nextSequence: 1 }, update: { nextSequence: { increment: 1 } }, select: { nextSequence: true } })
      await tx.syncChange.create({ data: { schoolId: actor.schoolId!, sequence: sequence.nextSequence, entityType: 'MARK', entityId: mark.id, action: 'UPSERT', version: (previous?.version || 0) + 1, operationId: conflict.operationId, payload: JSON.stringify(mark) } })
      await tx.syncConflict.update({ where: { id: conflict.id }, data: { resolution: 'CLIENT_WON', resolvedAt: new Date(), resolvedBy: actor.id } })
      await tx.syncOperation.updateMany({ where: { schoolId: actor.schoolId!, operationId: conflict.operationId }, data: { status: 'PROCESSED', error: null, response: JSON.stringify({ success: true, resolved: 'CLIENT_WON' }), processedAt: new Date() } })
      return mark
    })
    return NextResponse.json({ success: true, resolution: body.resolution, mark: result, preservedClientPayload: true })
  }
  await db.$transaction([
    db.syncConflict.update({ where: { id: conflict.id }, data: { resolution: body.resolution, resolvedAt: new Date(), resolvedBy: actor.id } }),
    db.syncOperation.updateMany({ where: { schoolId: actor.schoolId, operationId: conflict.operationId }, data: { status: body.resolution === 'SERVER_WON' ? 'PROCESSED' : 'FAILED', error: body.resolution === 'SERVER_WON' ? null : 'Client resolution requires a fresh authorized mutation' } }),
  ])
  return NextResponse.json({ success: true, resolution: body.resolution })
}
