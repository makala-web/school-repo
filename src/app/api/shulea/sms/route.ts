import { NextRequest, NextResponse } from 'next/server'
import { SmsResultsService } from '@/services/sms/SmsResultsService'
import { ConnectionManager } from '@/services/database/ConnectionManager'
import { TABLES, INDEXES } from '@/services/database/schema'
import { rejectDemoMutation } from '@/lib/server-auth'
import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/server-auth'

async function getActorAccess(request: NextRequest) {
  const actor = await getAuthenticatedUser(request)
  if (!actor) return { actor: null, error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(actor.role)) {
    return { actor: null, error: NextResponse.json({ error: 'SMS access denied' }, { status: 403 }) }
  }
  return { actor, error: null }
}

async function teacherCanAccessClass(actor: { id: string; role: string; schoolId?: string | null }, classId: string) {
  if (actor.role !== 'TEACHER') return true
  const teacher = await db.teacher.findUnique({ where: { userId: actor.id }, select: { id: true, schoolId: true } })
  if (!teacher) return false
  const [classAssignment, subjectAssignment] = await Promise.all([
    db.classTeacherAssignment.findFirst({ where: { teacherId: teacher.id, classId, status: 'ACTIVE' }, select: { id: true } }),
    db.teacherSubject.findFirst({ where: { teacherId: teacher.id, classId }, select: { id: true } }),
  ])
  return Boolean(classAssignment || subjectAssignment)
}

async function ensureSmsHistoryTable() {
  const conn = ConnectionManager
  try {
    await conn.execute(TABLES.SmsHistory)
    // Create indexes
    await conn.execute('CREATE INDEX IF NOT EXISTS idx_sms_history_sentAt ON SmsHistory(sentAt)')
    await conn.execute('CREATE INDEX IF NOT EXISTS idx_sms_history_status ON SmsHistory(status)')
    await conn.execute('CREATE INDEX IF NOT EXISTS idx_sms_history_student ON SmsHistory(studentId)')
  } catch (error) {
    console.error('Error ensuring SmsHistory table:', error)
    // Table might already exist, continue
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await getActorAccess(request)
    if (access.error || !access.actor) return access.error
    const actor = access.actor
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const examId = searchParams.get('examId')
    const studentId = searchParams.get('studentId')

    if (action === 'history') {
      await ensureSmsHistoryTable()
      const status = searchParams.get('status')
      const classId = searchParams.get('classId')
      const student = searchParams.get('student')
      const date = searchParams.get('date')
      const where: string[] = []
      const params: unknown[] = []

      if (status && status !== 'ALL') {
        where.push('status = ?')
        params.push(status)
      }
      if (classId && classId !== 'ALL') {
        const classRecord = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } })
        if (!classRecord || (actor.role !== 'SUPER_ADMIN' && classRecord.schoolId !== actor.schoolId) || !(await teacherCanAccessClass(actor, classId))) {
          return NextResponse.json({ error: 'Class SMS access denied' }, { status: 403 })
        }
        where.push('classId = ?')
        params.push(classId)
      }
      if (actor.role !== 'SUPER_ADMIN') {
        if (!actor.schoolId) return NextResponse.json({ history: [] })
        if (actor.role === 'TEACHER') {
          const teacher = await db.teacher.findUnique({ where: { userId: actor.id }, select: { id: true } })
          const assignments = teacher ? await db.classTeacherAssignment.findMany({ where: { teacherId: teacher.id, schoolId: actor.schoolId, status: 'ACTIVE' }, select: { classId: true } }) : []
          const subjects = teacher ? await db.teacherSubject.findMany({ where: { teacherId: teacher.id }, select: { classId: true } }) : []
          const classIds = [...new Set([...assignments.map(item => item.classId), ...subjects.map(item => item.classId)])]
          if (!classIds.length) return NextResponse.json({ history: [] })
          where.push(`classId IN (${classIds.map(() => '?').join(',')})`)
          params.push(...classIds)
        }
      }
      if (student) {
        where.push('(studentName LIKE ? OR studentId = ?)')
        params.push(`%${student}%`, student)
      }
      if (date) {
        where.push('substr(sentAt, 1, 10) = ?')
        params.push(date)
      }

      const conn = ConnectionManager
      const sql = `SELECT * FROM SmsHistory ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY sentAt DESC LIMIT 500`
      const records = await conn.query(sql, params)
      return NextResponse.json({ history: records })
    }

    if (!examId) {
      return NextResponse.json({ error: 'examId is required' }, { status: 400 })
    }

    const exam = await db.exam.findUnique({ where: { id: examId }, select: { classId: true, schoolId: true } })
    if (!exam || (actor.role !== 'SUPER_ADMIN' && exam.schoolId !== actor.schoolId) || !(await teacherCanAccessClass(actor, exam.classId))) {
      return NextResponse.json({ error: 'Exam SMS access denied' }, { status: 403 })
    }

    if (action === 'preview-student') {
      if (!studentId) {
        return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
      }
      const preview = await SmsResultsService.prepareForStudent(examId, studentId)
      return NextResponse.json({ preview })
    }

    if (action === 'preview-exam') {
      const previews = await SmsResultsService.prepareForExam(examId)
      return NextResponse.json({ previews })
    }

    return NextResponse.json({ error: 'Invalid SMS action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prepare SMS'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const access = await getActorAccess(request)
    if (access.error || !access.actor) return access.error
    const actor = access.actor
    await ensureSmsHistoryTable()
    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : [body]
    const now = new Date().toISOString()
    const conn = ConnectionManager

    for (const item of items) {
      const classId = item.classId ? String(item.classId) : ''
      if (!classId) return NextResponse.json({ error: 'classId is required for SMS history' }, { status: 400 })
      const classRecord = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } })
      if (!classRecord || (actor.role !== 'SUPER_ADMIN' && classRecord.schoolId !== actor.schoolId) || !(await teacherCanAccessClass(actor, classId))) {
        return NextResponse.json({ error: 'Class SMS access denied' }, { status: 403 })
      }
      await conn.execute(
        `INSERT INTO SmsHistory (id, recipient, studentId, studentName, classId, message, status, sentAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          String(item.recipient || item.phone || ''),
          item.studentId || null,
          String(item.studentName || 'Unknown Student'),
          item.classId || null,
          String(item.message || ''),
          String(item.status || 'SENT').toUpperCase(),
          item.sentAt || now,
          now
        ]
      )
    }

    return NextResponse.json({ message: 'SMS history saved', saved: items.length }, { status: 201 })
  } catch (error) {
    console.error('SMS POST error:', error)
    const message = error instanceof Error ? error.message : 'Failed to save SMS history'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
