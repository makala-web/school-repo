import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthenticatedUser, getAuthorizedClassIds } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const actor = await getAuthenticatedUser(request)
  if (!actor || actor.role === 'SUPER_ADMIN' || !actor.schoolId) return NextResponse.json({ error: 'Academic account required' }, { status: 403 })

  const authorizedClassIds = await getAuthorizedClassIds(actor, { allowSubjectAssignment: true })
  const classWhere = authorizedClassIds ? { schoolId: actor.schoolId, id: { in: authorizedClassIds } } : { schoolId: actor.schoolId }
  const [school, classes, teachers, gradingConfigs, sequence] = await Promise.all([
    // Hydration writes the school row into the local SQLite schema. Return the
    // complete non-sensitive record so required timestamps are preserved.
    db.school.findUnique({ where: { id: actor.schoolId } }),
    db.class.findMany({ where: classWhere, orderBy: { name: 'asc' }, include: { subjects: { include: { subject: true } } } }),
    db.teacher.findMany({ where: { schoolId: actor.schoolId, ...(authorizedClassIds ? { classTeacherAssignments: { some: { classId: { in: authorizedClassIds }, status: 'ACTIVE' } } } : {}) } }),
    db.gradingConfig.findMany({ where: { schoolId: actor.schoolId } }),
    db.syncSequence.findUnique({ where: { schoolId: actor.schoolId }, select: { nextSequence: true } }),
  ])
  if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 })

  const classIds = classes.map(item => item.id)
  const classSubjectIds = classes.flatMap(item => item.subjects.map(subject => subject.subjectId))
  const subjects = await db.subject.findMany({
    where: { schoolId: actor.schoolId, ...(authorizedClassIds ? { id: { in: [...new Set(classSubjectIds)] } } : {}) },
    orderBy: { name: 'asc' },
  })
  const students = await db.student.findMany({ where: { schoolId: actor.schoolId, classId: { in: classIds } } })
  const studentIds = students.map(item => item.id)
  const [exams, attendance, marks, results, tabia, assignments, teacherSubjects] = await Promise.all([
    db.exam.findMany({ where: { schoolId: actor.schoolId, classId: { in: classIds } } }),
    db.attendance.findMany({ where: { classId: { in: classIds }, studentId: { in: studentIds } } }),
    db.marksEntry.findMany({ where: { studentId: { in: studentIds }, exam: { schoolId: actor.schoolId } } }),
    db.studentResult.findMany({ where: { studentId: { in: studentIds }, exam: { schoolId: actor.schoolId } } }),
    db.tabia.findMany({ where: { studentId: { in: studentIds } } }),
    db.classTeacherAssignment.findMany({ where: { schoolId: actor.schoolId, classId: { in: classIds } } }),
    db.teacherSubject.findMany({ where: { classId: { in: classIds }, teacher: { schoolId: actor.schoolId } } }),
  ])
  const hydratedEntityIds = [...new Set([
    ...classIds,
    ...subjects.map(item => item.id),
    ...students.map(item => item.id),
    ...exams.map(item => item.id),
    ...attendance.map(item => item.id),
    ...marks.map(item => item.id),
    ...results.map(item => item.id),
    ...tabia.map(item => item.id),
    ...assignments.map(item => item.id),
    ...teacherSubjects.map(item => item.id),
  ])]
  const versions = hydratedEntityIds.length
    ? await db.syncChange.findMany({
        where: { schoolId: actor.schoolId, entityId: { in: hydratedEntityIds } },
        orderBy: { sequence: 'desc' },
        distinct: ['entityType', 'entityId'],
        select: { entityType: true, entityId: true, version: true },
      })
    : []

  return NextResponse.json({
    school,
    classes,
    subjects,
    teachers,
    gradingConfigs,
    students,
    exams,
    attendance,
    marks,
    results,
    tabia,
    assignments,
    teacherSubjects,
    versions,
    cursor: sequence?.nextSequence || 0,
    scope: { role: actor.role, classIds },
  })
}
