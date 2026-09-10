import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canAccessClass, getAuthenticatedUser, rejectDemoMutation } from '@/lib/server-auth'

const VALID_STATUSES = new Set(['PRESENT', 'ABSENT', 'SICK', 'PERMISSION'])

function isDateRangeValid(fromDate: string | null, toDate: string | null) {
  return Boolean(fromDate && toDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate) && /^\d{4}-\d{2}-\d{2}$/.test(toDate) && fromDate <= toDate)
}

function daysBetween(fromDate: string, toDate: string) {
  return Math.floor((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86400000) + 1
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const date = searchParams.get('date')
    const action = searchParams.get('action')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    if (!classId) return NextResponse.json({ error: 'Class ID is required' }, { status: 400 })

    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Academic account required' }, { status: 403 })
    if (!(await canAccessClass(actor, classId, { allowSubjectAssignment: true }))) {
      return NextResponse.json({ error: 'Teacher is not authorized for this class' }, { status: 403 })
    }

    const classRecord = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } })
    if (!classRecord || classRecord.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Class access denied' }, { status: 403 })

    if (action === 'report') {
      if (!isDateRangeValid(fromDate, toDate)) return NextResponse.json({ error: 'Valid report start and end dates are required' }, { status: 400 })
      const students = await db.student.findMany({
        where: { schoolId: actor.schoolId, classId, status: 'ACTIVE' },
        select: {
          id: true, fullName: true, admissionNo: true,
          attendance: { where: { classId, date: { gte: fromDate!, lte: toDate! } }, select: { status: true } },
        },
        orderBy: { fullName: 'asc' },
      })
      const totalDays = daysBetween(fromDate!, toDate!)
      return NextResponse.json({
        classId,
        fromDate,
        toDate,
        students: students.map(student => {
          const counts = { PRESENT: 0, ABSENT: 0, SICK: 0, PERMISSION: 0 }
          for (const item of student.attendance) if (item.status in counts) counts[item.status as keyof typeof counts] += 1
          const recordedDays = student.attendance.length
          return { id: student.id, fullName: student.fullName, admissionNo: student.admissionNo, totalDays, recordedDays, ...counts, unmarked: Math.max(totalDays - recordedDays, 0) }
        }),
      })
    }

    if (!date) return NextResponse.json({ error: 'Class ID and date are required' }, { status: 400 })

    const students = await db.student.findMany({
      where: { schoolId: actor.schoolId, classId, status: 'ACTIVE' },
      select: { id: true, fullName: true, admissionNo: true, gender: true, attendance: { where: { classId, date }, select: { status: true } } },
      orderBy: { fullName: 'asc' },
    })

    return NextResponse.json({
      classId,
      date,
      students: students.map(({ attendance, ...student }) => ({ ...student, status: attendance[0]?.status || null })),
    })
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request)
  if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Academic account required' }, { status: 403 })
    const body = await request.json() as { classId?: string; date?: string; records?: Array<{ studentId?: string; status?: string }> }
    const classId = body.classId || ''
    const date = body.date || ''
    const records = body.records || []
    if (!classId || !date || records.length === 0) return NextResponse.json({ error: 'Class, date and attendance records are required' }, { status: 400 })
    if (!(await canAccessClass(actor, classId, { allowSubjectAssignment: true }))) return NextResponse.json({ error: 'Class access denied' }, { status: 403 })

    const classRecord = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } })
    if (!classRecord || classRecord.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Cross-school attendance denied' }, { status: 403 })
    const studentIds = records.map(record => record.studentId || '')
    if (studentIds.some(id => !id) || records.some(record => !VALID_STATUSES.has(record.status || ''))) {
      return NextResponse.json({ error: 'Invalid attendance record' }, { status: 400 })
    }
    const students = await db.student.findMany({ where: { id: { in: studentIds }, schoolId: actor.schoolId, classId }, select: { id: true } })
    if (students.length !== studentIds.length) return NextResponse.json({ error: 'Attendance student does not belong to this class' }, { status: 403 })

    await db.$transaction(records.map(record => db.attendance.upsert({
      where: { studentId_classId_date: { studentId: record.studentId!, classId, date } },
      create: { studentId: record.studentId!, classId, date, status: record.status! },
      update: { status: record.status! },
    })))
    return NextResponse.json({ saved: records.length, message: 'Attendance saved successfully' })
  } catch (error) {
    console.error('Error saving attendance:', error)
    return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 })
  }
}
