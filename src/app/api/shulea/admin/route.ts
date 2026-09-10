import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSchoolLicenseStatus } from '@/lib/access-control'
import { getAuthenticatedUser } from '@/lib/server-auth'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const schoolId = searchParams.get('schoolId')
    const actorUserId = searchParams.get('actorUserId')

    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SUPER_ADMIN' || !actor.active) {
      return NextResponse.json({ success: false, error: 'Platform administrator access is required' }, { status: 403 })
    }

    const [schools, platformUsers, pendingInvitations, activeSessions] = await Promise.all([
      db.school.findMany({
      where: schoolId ? { id: schoolId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { teachers: true, students: true, classes: true, devices: true, users: true } },
      },
      }),
      db.user.findMany({
        where: schoolId ? { schoolId } : { role: { not: 'SUPER_ADMIN' } },
        select: { id: true, fullName: true, email: true, role: true, active: true, school: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
      db.invitation.count({ where: { status: 'PENDING' } }),
      db.authSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    ])

    const payload = await Promise.all(schools.map(async (school) => {
      const license = getSchoolLicenseStatus({
        status: school.licenseStatus || 'ACTIVE',
        expiryDate: school.expiryDate || undefined,
      })
      const schoolAdmins = await db.user.count({ where: { schoolId: school.id, role: 'SCHOOL_ADMIN', active: true } })

      return {
        id: school.id,
        name: school.name,
        schoolType: school.schoolType,
        isDemo: Boolean(school.isDemo),
        licenseType: school.licenseType || 'DEMO',
        licenseStatus: school.licenseStatus || 'ACTIVE',
        status: license.isActive ? 'ACTIVE' : 'BLOCKED',
        expiryDate: school.expiryDate,
        maxTeachers: school.maxTeachers || 0,
        maxDevices: school.maxDevices || 0,
        teachers: school._count.teachers,
        students: school._count.students,
        classes: school._count.classes,
        devices: school._count.devices,
        schoolAdmins,
        location: [school.region, school.district].filter(Boolean).join(', ') || '-',
        lastActivity: school.updatedAt,
        activationCode: school.activationCode,
        renewalRequestedAt: school.renewalRequestedAt,
      }
    }))

    return NextResponse.json({
      success: true,
      schools: payload,
      schoolId,
      control: {
        pendingInvitations,
        activeSessions,
        users: platformUsers,
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch school administration data',
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, schoolId, actorUserId, status, licenseType, expiryDate, maxTeachers, maxDevices, maxStudents } = body

    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'schoolId is required' }, { status: 400 })
    }

    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SUPER_ADMIN' || !actor.active) {
      return NextResponse.json({ success: false, error: 'Platform administrator access is required' }, { status: 403 })
    }

    if (action === 'update-license') {
      const school = await db.school.update({
        where: { id: schoolId },
        data: {
          licenseType: licenseType || 'STANDARD',
          licenseStatus: status || 'ACTIVE',
          expiryDate: expiryDate || null,
          maxTeachers: maxTeachers ?? null,
          maxDevices: maxDevices ?? null,
          maxStudents: maxStudents ?? null,
          renewalRequestedAt: null,
          renewalRequestedBy: null,
        },
      })

      return NextResponse.json({ success: true, school })
    }

    if (action === 'delete-school') {
      const school = await db.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, isDemo: true } })
      if (!school) return NextResponse.json({ success: false, error: 'School not found' }, { status: 404 })
      if (body.confirmation !== school.id) {
        return NextResponse.json({ success: false, error: 'Type the school ID to confirm deletion' }, { status: 400 })
      }

      await db.$transaction(async (tx) => {
        const [classes, students, subjects, exams, teachers, users] = await Promise.all([
          tx.class.findMany({ where: { schoolId: school.id }, select: { id: true } }),
          tx.student.findMany({ where: { schoolId: school.id }, select: { id: true } }),
          tx.subject.findMany({ where: { schoolId: school.id }, select: { id: true } }),
          tx.exam.findMany({ where: { schoolId: school.id }, select: { id: true } }),
          tx.teacher.findMany({ where: { schoolId: school.id }, select: { id: true } }),
          tx.user.findMany({ where: { schoolId: school.id }, select: { id: true } }),
        ])
        const classIds = classes.map(item => item.id)
        const studentIds = students.map(item => item.id)
        const subjectIds = subjects.map(item => item.id)
        const examIds = exams.map(item => item.id)
        const teacherIds = teachers.map(item => item.id)
        const userIds = users.map(item => item.id)

        await tx.marksEntry.deleteMany({ where: { OR: [{ examId: { in: examIds } }, { studentId: { in: studentIds } }] } })
        await tx.studentResult.deleteMany({ where: { OR: [{ examId: { in: examIds } }, { studentId: { in: studentIds } }, { classId: { in: classIds } }] } })
        await tx.attendance.deleteMany({ where: { OR: [{ studentId: { in: studentIds } }, { classId: { in: classIds } }] } })
        await tx.tabia.deleteMany({ where: { OR: [{ studentId: { in: studentIds } }, { classId: { in: classIds } }] } })
        await tx.teacherSubject.deleteMany({ where: { OR: [{ teacherId: { in: teacherIds } }, { classId: { in: classIds } }, { subjectId: { in: subjectIds } }] } })
        await tx.classSubject.deleteMany({ where: { OR: [{ classId: { in: classIds } }, { subjectId: { in: subjectIds } }] } })
        await tx.classTeacherAssignment.deleteMany({ where: { schoolId: school.id } })
        await tx.schoolLeadership.deleteMany({ where: { schoolId: school.id } })
        await tx.invitation.deleteMany({ where: { schoolId: school.id } })
        await tx.device.deleteMany({ where: { schoolId: school.id } })
        await tx.auditLog.deleteMany({ where: { schoolId: school.id } })
        await tx.accessRequest.deleteMany({ where: { schoolId: school.id } })
        await tx.exam.deleteMany({ where: { id: { in: examIds } } })
        await tx.student.deleteMany({ where: { id: { in: studentIds } } })
        await tx.class.deleteMany({ where: { id: { in: classIds } } })
        await tx.subject.deleteMany({ where: { id: { in: subjectIds } } })
        await tx.teacher.deleteMany({ where: { id: { in: teacherIds } } })
        await tx.authSession.deleteMany({ where: { userId: { in: userIds } } })
        await tx.user.deleteMany({ where: { id: { in: userIds } } })
        await tx.gradingConfig.deleteMany({ where: { schoolId: school.id } })
        await tx.school.delete({ where: { id: school.id } })
      })
      return NextResponse.json({ success: true, message: `${school.name} deleted successfully` })
    }

    return NextResponse.json({ success: false, error: 'Unsupported admin action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Admin action failed',
    }, { status: 500 })
  }
}
