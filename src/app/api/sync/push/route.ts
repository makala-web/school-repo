import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

const SYNCABLE_ENDPOINTS = new Set([
  '/api/shulea/students',
  '/api/shulea/teachers',
  '/api/shulea/classes',
  '/api/shulea/subjects',
  '/api/shulea/attendance',
  '/api/shulea/exams',
  '/api/shulea/marks',
  '/api/shulea/results',
  '/api/shulea/tabia',
  '/api/shulea/grading',
])

function jsonValue(value: string | null) {
  if (!value) return null
  try { return JSON.parse(value) as unknown } catch { return value }
}

function getEntity(endpoint: string, method: string, body: Record<string, unknown>) {
  const path = endpoint.split('?')[0]
  const query = new URL(endpoint, 'http://sync.local').searchParams
  const map: Record<string, string> = {
    '/api/shulea/students': 'STUDENT',
    '/api/shulea/teachers': 'TEACHER',
    '/api/shulea/classes': 'CLASS',
    '/api/shulea/subjects': 'SUBJECT',
    '/api/shulea/attendance': 'ATTENDANCE',
    '/api/shulea/exams': 'EXAM',
    '/api/shulea/marks': 'MARK',
    '/api/shulea/results': 'RESULT',
    '/api/shulea/tabia': 'TABIA',
    '/api/shulea/grading': 'GRADING_CONFIG',
  }
  if (path === '/api/shulea/subjects' && body.action === 'assign-to-class') return { entityType: 'CLASS_SUBJECT', entityId: typeof body.classId === 'string' ? body.classId : null, operationType: `${method} ${path}` }
  if (path === '/api/shulea/teachers' && ['assign-subject', 'remove-assignment', 'update-assignment'].includes(String(body.action))) {
    return { entityType: 'TEACHER_SUBJECT', entityId: typeof body.assignmentId === 'string' ? body.assignmentId : null, operationType: `${method} ${path}` }
  }
  const entityType = map[path] || 'UNKNOWN'
  const id = body.id || body.studentId || body.teacherId || body.classId || body.subjectId || body.examId || query.get('id') || query.get('studentId') || query.get('teacherId') || query.get('classId') || query.get('subjectId') || query.get('examId')
  return { entityType, entityId: typeof id === 'string' ? id : null, operationType: `${method} ${path}` }
}

function getResponseEntityId(response: string) {
  const parsed = jsonValue(response)
  if (!parsed || typeof parsed !== 'object') return null
  const value = parsed as Record<string, unknown>
  const candidate = value.id || value.studentId || value.teacherId || value.classId || value.subjectId || value.examId ||
    (value.student && typeof value.student === 'object' ? (value.student as Record<string, unknown>).id : null) ||
    (value.teacher && typeof value.teacher === 'object' ? (value.teacher as Record<string, unknown>).id : null) ||
    (value.class && typeof value.class === 'object' ? (value.class as Record<string, unknown>).id : null)
  return typeof candidate === 'string' ? candidate : null
}

function errorMessage(response: string) {
  const parsed = jsonValue(response)
  if (parsed && typeof parsed === 'object' && 'error' in parsed) return String(parsed.error)
  return response.slice(0, 500) || 'Synchronization request failed'
}

type SyncTarget = {
  entityType: string
  entityId: string
  payload: string | null
}

async function resolveTargets(
  endpoint: string,
  method: string,
  body: Record<string, unknown>,
  schoolId: string,
  fallback: { entityType: string; entityId: string | null },
  responseText: string,
): Promise<SyncTarget[]> {
  const path = endpoint.split('?')[0]

  if (method !== 'DELETE' && path === '/api/shulea/attendance' && Array.isArray(body.records)) {
    const classId = typeof body.classId === 'string' ? body.classId : null
    const date = typeof body.date === 'string' ? body.date : null
    const studentIds = body.records
      .map(item => item && typeof item === 'object' && typeof (item as Record<string, unknown>).studentId === 'string' ? (item as Record<string, unknown>).studentId as string : null)
      .filter((value): value is string => Boolean(value))
    if (classId && date && studentIds.length) {
      const rows = await db.attendance.findMany({ where: { classId, date, studentId: { in: studentIds }, class: { schoolId } } })
      return rows.map(row => ({ entityType: 'ATTENDANCE', entityId: row.id, payload: JSON.stringify(row) }))
    }
  }

  if (method !== 'DELETE' && path === '/api/shulea/marks' && body.action === 'bulk-save' && Array.isArray(body.marks)) {
    const entries = body.marks.filter(item => item && typeof item === 'object') as Array<Record<string, unknown>>
    const studentIds = entries.map(item => item.studentId).filter((value): value is string => typeof value === 'string')
    const examIds = entries.map(item => item.examId).filter((value): value is string => typeof value === 'string')
    const classSubjectIds = entries.map(item => item.classSubjectId).filter((value): value is string => typeof value === 'string')
    if (studentIds.length && examIds.length && classSubjectIds.length) {
      const rows = await db.marksEntry.findMany({ where: { studentId: { in: studentIds }, examId: { in: examIds }, classSubjectId: { in: classSubjectIds }, exam: { schoolId } } })
      const expected = new Set(entries.map(item => `${item.studentId}:${item.classSubjectId}:${item.examId}`))
      return rows
        .filter(row => expected.has(`${row.studentId}:${row.classSubjectId}:${row.examId}`))
        .map(row => ({ entityType: 'MARK', entityId: row.id, payload: JSON.stringify(row) }))
    }
  }

  if (path === '/api/shulea/subjects' && body.action === 'assign-to-class' && typeof body.classId === 'string') {
    const rows = await db.classSubject.findMany({ where: { classId: body.classId, class: { schoolId } } })
    return rows.map(row => ({ entityType: 'CLASS_SUBJECT', entityId: row.id, payload: JSON.stringify(row) }))
  }

  if (path === '/api/shulea/teachers' && ['assign-subject', 'remove-assignment', 'update-assignment'].includes(String(body.action))) {
    if (body.action === 'remove-assignment' && typeof body.assignmentId === 'string') {
      return [{ entityType: 'TEACHER_SUBJECT', entityId: body.assignmentId, payload: null }]
    }
    const rows = await db.teacherSubject.findMany({
      where: {
        teacher: { schoolId },
        ...(typeof body.teacherId === 'string' ? { teacherId: body.teacherId } : {}),
        ...(typeof body.classId === 'string' ? { classId: body.classId } : {}),
      },
    })
    return rows.map(row => ({ entityType: 'TEACHER_SUBJECT', entityId: row.id, payload: JSON.stringify(row) }))
  }

  if (path === '/api/shulea/grading' && method !== 'DELETE') {
    const rows = await db.gradingConfig.findMany({ where: { schoolId } })
    return rows.map(row => ({ entityType: 'GRADING_CONFIG', entityId: row.id, payload: JSON.stringify(row) }))
  }

  const responseEntityId = getResponseEntityId(responseText)
  const entityId = fallback.entityId || responseEntityId
  return entityId ? [{ entityType: fallback.entityType, entityId, payload: method === 'DELETE' ? null : body ? JSON.stringify(body) : null }] : []
}

export async function POST(request: NextRequest) {
  const actor = await getAuthenticatedUser(request)
  if (!actor || actor.role === 'SUPER_ADMIN' || !actor.schoolId) {
    return NextResponse.json({ error: 'Academic account required' }, { status: 403 })
  }
  const schoolId = actor.schoolId

  const operationId = request.headers.get('x-shulea-operation-id')
  if (!operationId || operationId.length > 160) {
    return NextResponse.json({ error: 'A valid operation ID is required' }, { status: 400 })
  }

  let envelope: { endpoint?: string; method?: string; body?: string; baseVersion?: number; deviceId?: string }
  try { envelope = await request.json() as typeof envelope } catch {
    return NextResponse.json({ error: 'Malformed synchronization payload' }, { status: 400 })
  }

  const endpoint = envelope.endpoint || ''
  const method = (envelope.method || 'POST').toUpperCase()
  if (!SYNCABLE_ENDPOINTS.has(endpoint.split('?')[0]) || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return NextResponse.json({ error: 'Endpoint is not syncable' }, { status: 422 })
  }
  if (typeof envelope.body !== 'string' || envelope.body.length > 1024 * 1024) {
    return NextResponse.json({ error: 'Synchronization payload is missing or too large' }, { status: 413 })
  }

  let body: Record<string, unknown>
  try { body = JSON.parse(envelope.body) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Synchronization body must be JSON' }, { status: 422 })
  }
  if (typeof body.schoolId === 'string' && body.schoolId !== actor.schoolId) {
    return NextResponse.json({ error: 'Cross-school synchronization denied' }, { status: 403 })
  }

  const entity = getEntity(endpoint, method, body)
  const existing = await db.syncOperation.findUnique({
    where: { schoolId_operationId: { schoolId: actor.schoolId, operationId } },
  })
  if (existing?.status === 'PROCESSED') {
    return new NextResponse(existing.response || JSON.stringify({ success: true, replay: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Shulea-Replay': 'true' },
    })
  }
  if (existing?.status === 'CONFLICT') {
    return NextResponse.json({ error: 'Conflict requires resolution', operationId }, { status: 409 })
  }
  if (existing?.status === 'PROCESSING') {
    const stale = existing.createdAt.getTime() < Date.now() - 10 * 60 * 1000
    if (!stale) return NextResponse.json({ error: 'Operation is already being processed', operationId }, { status: 202 })
    await db.syncOperation.updateMany({ where: { id: existing.id, status: 'PROCESSING' }, data: { status: 'FAILED', error: 'Previous synchronization attempt expired before completion; retrying idempotently' } })
  }

  if (existing?.status === 'FAILED') {
    const claimed = await db.syncOperation.updateMany({ where: { id: existing.id, status: 'FAILED' }, data: { status: 'PROCESSING', error: null, response: null, processedAt: null } })
    if (!claimed.count) return NextResponse.json({ error: 'Operation is already being retried', operationId }, { status: 202 })
  }

  // Reserve the operation before touching academic data. A concurrent retry
  // sees PROCESSING and cannot execute the upstream mutation a second time.
  try {
    await db.syncOperation.create({
      data: { operationId, schoolId: actor.schoolId, userId: actor.id, deviceId: envelope.deviceId, endpoint, method, operationType: entity.operationType, entityType: entity.entityType, entityId: entity.entityId, payload: envelope.body, status: 'PROCESSING' },
    })
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error
    const retry = await db.syncOperation.findUnique({ where: { schoolId_operationId: { schoolId: actor.schoolId, operationId } } })
    if (retry?.status === 'PROCESSED') return new NextResponse(retry.response || JSON.stringify({ success: true, replay: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Shulea-Replay': 'true' } })
    if (retry?.status === 'FAILED') {
      const claimed = await db.syncOperation.updateMany({ where: { id: retry.id, status: 'FAILED' }, data: { status: 'PROCESSING', error: null, response: null, processedAt: null } })
      if (!claimed.count) return NextResponse.json({ error: 'Operation is already being retried', operationId }, { status: 202 })
    } else {
      return NextResponse.json({ error: 'Operation is already being processed', operationId }, { status: 202 })
    }
  }

  if (entity.entityId && envelope.baseVersion !== undefined) {
    const latest = await db.syncChange.findFirst({
      where: { schoolId: actor.schoolId, entityType: entity.entityType, entityId: entity.entityId },
      orderBy: { sequence: 'desc' },
      select: { version: true, payload: true },
    })
    if (latest && latest.version > envelope.baseVersion) {
      await db.$transaction([
        db.syncOperation.update({
          where: { schoolId_operationId: { schoolId: actor.schoolId, operationId } },
          data: { status: 'CONFLICT', error: 'Server version is newer' },
        }),
        db.syncConflict.create({
          data: { schoolId: actor.schoolId, operationId, entityType: entity.entityType, entityId: entity.entityId, baseVersion: envelope.baseVersion, serverVersion: latest.version, clientPayload: envelope.body, serverPayload: latest.payload },
        }),
      ])
      return NextResponse.json({ error: 'Conflict requires resolution', operationId, serverVersion: latest.version }, { status: 409 })
    }
  }

  const cookie = request.headers.get('cookie') || ''
  let upstream: Response
  try {
    upstream = await fetch(new URL(endpoint, request.url), {
      method,
      headers: { 'Content-Type': 'application/json', cookie, 'X-Shulea-Operation-Id': operationId },
      body: envelope.body,
      cache: 'no-store',
    })
  } catch {
    await db.syncOperation.update({ where: { id: (await db.syncOperation.findUniqueOrThrow({ where: { schoolId_operationId: { schoolId: actor.schoolId, operationId } } })).id }, data: { status: 'FAILED', error: 'Upstream mutation unavailable' } })
    return NextResponse.json({ error: 'Synchronization temporarily unavailable' }, { status: 503 })
  }

  const responseText = await upstream.text()
  if (!upstream.ok) {
    await db.syncOperation.updateMany({ where: { schoolId: actor.schoolId, operationId }, data: { status: 'FAILED', error: errorMessage(responseText), response: responseText.slice(0, 20000) } })
    return new NextResponse(responseText, { status: upstream.status, headers: { 'Content-Type': 'application/json' } })
  }

  const operation = await db.syncOperation.findUniqueOrThrow({ where: { schoolId_operationId: { schoolId: actor.schoolId, operationId } } })
  const targets = await resolveTargets(endpoint, method, body, schoolId, entity, responseText)
  const entityId = entity.entityId || targets[0]?.entityId || null
  const action = method === 'DELETE' || body.action === 'remove-assignment' ? 'DELETE' : 'UPSERT'
  try {
    await db.$transaction(async (tx) => {
    await tx.syncOperation.update({ where: { id: operation.id }, data: { status: 'PROCESSED', response: responseText.slice(0, 20000), processedAt: new Date(), error: null, entityId } })
    for (const target of targets) {
      const previous = await tx.syncChange.findFirst({ where: { schoolId, entityType: target.entityType, entityId: target.entityId }, orderBy: { sequence: 'desc' }, select: { version: true } })
      const sequence = await tx.syncSequence.upsert({
        where: { schoolId },
        create: { schoolId, nextSequence: 1 },
        update: { nextSequence: { increment: 1 } },
        select: { nextSequence: true },
      })
      await tx.syncChange.create({ data: { schoolId, sequence: sequence.nextSequence, entityType: target.entityType, entityId: target.entityId, action, version: (previous?.version || 0) + 1, operationId, payload: action === 'DELETE' ? null : target.payload, deletedAt: action === 'DELETE' ? new Date() : null } })
    }
    })
  } catch {
    await db.syncOperation.updateMany({ where: { schoolId, operationId }, data: { status: 'FAILED', error: 'Cloud ledger transaction failed; the operation is retained for idempotent retry' } })
    return NextResponse.json({ error: 'Synchronization ledger transaction failed; retry is required', operationId }, { status: 503 })
  }
  return new NextResponse(responseText, { status: upstream.status, headers: { 'Content-Type': 'application/json', 'X-Shulea-Operation-Id': operationId } })
}
