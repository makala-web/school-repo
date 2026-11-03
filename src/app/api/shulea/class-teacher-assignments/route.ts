import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

/**
 * GET /api/shulea/class-teacher-assignments
 * Get class teacher assignments filtered by school and/or class
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const academicYear = searchParams.get('academicYear');
    const actorUserId = searchParams.get('actorUserId');
    const includeHistory = searchParams.get('includeHistory') === 'true';

    if (!schoolId) {
      return NextResponse.json(
        { error: 'School ID is required' },
        { status: 400 }
      );
    }

    // Verify actor has access to school (Super Admin or School Admin)
    const actor = await getAuthenticatedUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (actorUserId && actorUserId !== actor.id) return NextResponse.json({ error: 'Session user mismatch' }, { status: 403 });

    const isAuthorized = actor.role === 'SUPER_ADMIN' || 
      (actor.role === 'SCHOOL_ADMIN' && actor.schoolId === schoolId);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build filter
    const where: any = { schoolId };
    if (classId) where.classId = classId;
    if (academicYear) where.academicYear = academicYear;
    if (!includeHistory) where.status = 'ACTIVE';

    const assignments = await db.classTeacherAssignment.findMany({
      where,
      include: {
        class: true,
        teacher: { select: { id: true, name: true, shortName: true, sign: true, phone: true, schoolId: true, userId: true } },
        school: true
      },
      orderBy: [{ class: { name: 'asc' } }]
    });

    return NextResponse.json({
      assignments,
      total: assignments.length
    });
  } catch (error) {
    console.error('Error fetching class teacher assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shulea/class-teacher-assignments
 * Create, update, or delete class teacher assignments
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, actorUserId, ...data } = body;

    // Verify actor
    const actor = await getAuthenticatedUser(request);
    if (!actor || !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (actorUserId && actorUserId !== actor.id) return NextResponse.json({ error: 'Session user mismatch' }, { status: 403 });

    if (action === 'assign') {
      return handleAssignClassTeacher(data, actor);
    }

    if (action === 'update') {
      return handleUpdateAssignment(data, actor);
    }

    if (action === 'remove') {
      return handleRemoveAssignment(data, actor);
    }

    if (action === 'get-by-teacher') {
      return handleGetByTeacher(data, actor);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Class teacher assignment error:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'A class teacher was assigned to this class and academic year concurrently. Reload assignments and try again.' }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'Failed to process assignment' },
      { status: 500 }
    );
  }
}

async function handleAssignClassTeacher(data: {
  id?: string;
  schoolId: string;
  classId: string;
  teacherId: string;
  academicYear: string;
  startDate: string;
}, actor: any) {
  const { id, schoolId, classId, teacherId, academicYear, startDate } = data;

  // Validate school access
  if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Verify class exists and belongs to school
  const classRecord = await db.class.findUnique({
    where: { id: classId }
  });

  if (!classRecord || classRecord.schoolId !== schoolId) {
    return NextResponse.json(
      { error: 'Class not found or does not belong to school' },
      { status: 404 }
    );
  }

  // Verify teacher exists and belongs to school
  const teacher = await db.teacher.findUnique({
    where: { id: teacherId },
    include: { user: { select: { role: true } } },
  });

  if (!teacher || teacher.schoolId !== schoolId) {
    return NextResponse.json(
      { error: 'Teacher not found or does not belong to school' },
      { status: 404 }
    );
  }
  if (teacher.user && teacher.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Only invited teacher accounts can be assigned as Class Teachers' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10)
  const result = await db.$transaction(async (tx) => {
    const existingActive = await tx.classTeacherAssignment.findFirst({
      where: { schoolId, classId, academicYear, status: 'ACTIVE' },
    })
    if (existingActive?.teacherId === teacherId) return { assignment: existingActive, alreadyExists: true }

    if (existingActive) {
      await tx.classTeacherAssignment.update({
        where: { id: existingActive.id },
        data: { status: 'INACTIVE', endDate: today },
      })
    }
    const assignment = await tx.classTeacherAssignment.create({
      data: { ...(id ? { id } : {}), schoolId, classId, teacherId, academicYear, startDate, status: 'ACTIVE' },
      include: {
        class: true,
        teacher: { select: { id: true, name: true, shortName: true, sign: true, phone: true, schoolId: true, userId: true } },
        school: true,
      },
    })
    // Keep the legacy field aligned only with the school's current academic year.
    const school = await tx.school.findUnique({ where: { id: schoolId }, select: { academicYear: true } })
    if (!school?.academicYear || school.academicYear === academicYear) {
      await tx.class.update({ where: { id: classId }, data: { classTeacherId: teacherId } })
    }
    await tx.auditLog.create({
      data: {
        action: 'CLASS_TEACHER_ASSIGNED', entityType: 'CLASS_TEACHER_ASSIGNMENT',
        entityId: assignment.id, schoolId, userId: actor.id,
        details: `${teacher.name} assigned as class teacher for ${classRecord.fullName} (${academicYear})`,
      },
    })
    return { assignment, alreadyExists: false }
  })

  const { assignment, alreadyExists } = result
  if (alreadyExists) return NextResponse.json({
    message: 'This teacher is already assigned to the selected class for this academic year.',
    assignment,
    alreadyExists: true,
  })

  return NextResponse.json({
    message: 'Class teacher assigned successfully',
    assignment
  }, { status: 201 });
}

async function handleUpdateAssignment(data: {
  assignmentId: string;
  teacherId?: string;
  status?: string;
  endDate?: string;
}, actor: any) {
  const { assignmentId, ...updateData } = data;

  const assignment = await db.classTeacherAssignment.findUnique({
    where: { id: assignmentId }
  });

  if (!assignment) {
    return NextResponse.json(
      { error: 'Assignment not found' },
      { status: 404 }
    );
  }

  // Verify school access
  if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== assignment.schoolId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // If changing teacher, verify new teacher exists
  if (updateData.teacherId) {
    const newTeacher = await db.teacher.findUnique({
      where: { id: updateData.teacherId },
      include: { user: { select: { role: true } } },
    });

    if (!newTeacher || newTeacher.schoolId !== assignment.schoolId) {
      return NextResponse.json(
        { error: 'Teacher not found or does not belong to school' },
        { status: 404 }
      );
    }
    if (newTeacher.user && newTeacher.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Only invited teacher accounts can be assigned as Class Teachers' }, { status: 400 });
    }
  }

  const result = await db.$transaction(async (tx) => {
  if (updateData.status === 'ACTIVE' || (assignment.status === 'ACTIVE' && updateData.teacherId)) {
    const existingActive = await tx.classTeacherAssignment.findFirst({
      where: {
        schoolId: assignment.schoolId,
        classId: assignment.classId,
        academicYear: assignment.academicYear,
        status: 'ACTIVE',
        id: { not: assignmentId },
      },
    })
    if (existingActive) {
      await tx.classTeacherAssignment.update({
        where: { id: existingActive.id },
        data: { status: 'INACTIVE', endDate: new Date().toISOString().split('T')[0] },
      })
    }
  }

  const updated = await tx.classTeacherAssignment.update({
    where: { id: assignmentId },
    data: updateData,
    include: {
      class: true,
      teacher: { select: { id: true, name: true, shortName: true, sign: true, phone: true, schoolId: true, userId: true } },
      school: true
    }
  });

  const nextActiveAssignment = await tx.classTeacherAssignment.findFirst({
    where: { classId: assignment.classId, schoolId: assignment.schoolId, academicYear: assignment.academicYear, status: 'ACTIVE' },
    select: { teacherId: true },
  })
  const school = await tx.school.findUnique({ where: { id: assignment.schoolId }, select: { academicYear: true } })
  if (!school?.academicYear || school.academicYear === assignment.academicYear) {
    await tx.class.update({ where: { id: assignment.classId }, data: { classTeacherId: nextActiveAssignment?.teacherId || null } })
  }
  await tx.auditLog.create({
    data: {
      action: 'CLASS_TEACHER_ASSIGNMENT_UPDATED',
      entityType: 'CLASS_TEACHER_ASSIGNMENT',
      entityId: assignmentId,
      schoolId: assignment.schoolId,
      userId: actor.id,
      details: `Assignment updated: ${JSON.stringify(updateData)}`
    }
  });
  return updated
  })

  return NextResponse.json({
    message: 'Assignment updated successfully',
    assignment: result
  });
}

async function handleRemoveAssignment(data: {
  assignmentId: string;
}, actor: any) {
  const { assignmentId } = data;

  const assignment = await db.classTeacherAssignment.findUnique({
    where: { id: assignmentId }
  });

  if (!assignment) {
    return NextResponse.json(
      { error: 'Assignment not found' },
      { status: 404 }
    );
  }

  // Verify school access
  if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== assignment.schoolId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const updated = await db.$transaction(async (tx) => {
    const removed = await tx.classTeacherAssignment.update({
      where: { id: assignmentId },
      data: { status: 'INACTIVE', endDate: new Date().toISOString().slice(0, 10) },
      include: {
        class: true,
        teacher: { select: { id: true, name: true, shortName: true, sign: true, phone: true, schoolId: true, userId: true } },
        school: true,
      },
    })
    const nextActiveAssignment = await tx.classTeacherAssignment.findFirst({
      where: { classId: assignment.classId, schoolId: assignment.schoolId, academicYear: assignment.academicYear, status: 'ACTIVE' },
      select: { teacherId: true },
    })
    const school = await tx.school.findUnique({ where: { id: assignment.schoolId }, select: { academicYear: true } })
    if (!school?.academicYear || school.academicYear === assignment.academicYear) {
      await tx.class.update({ where: { id: assignment.classId }, data: { classTeacherId: nextActiveAssignment?.teacherId || null } })
    }
    await tx.auditLog.create({
    data: {
      action: 'CLASS_TEACHER_ASSIGNMENT_REMOVED',
      entityType: 'CLASS_TEACHER_ASSIGNMENT',
      entityId: assignmentId,
      schoolId: assignment.schoolId,
      userId: actor.id,
      details: `Class teacher assignment removed`
    }
    })
    return removed
  })

  return NextResponse.json({
    message: 'Assignment removed successfully',
    assignment: updated
  });
}

async function handleGetByTeacher(data: {
  teacherId: string;
  academicYear?: string;
}, actor: any) {
  const { teacherId, academicYear } = data;

  const teacher = await db.teacher.findUnique({
    where: { id: teacherId }
  });

  if (!teacher || (actor.role !== 'SUPER_ADMIN' && teacher.schoolId !== actor.schoolId)) {
    return NextResponse.json(
      { error: 'Teacher not found' },
      { status: 404 }
    );
  }

  const where: any = {
    teacherId,
    schoolId: teacher.schoolId,
    status: 'ACTIVE'
  };

  if (academicYear) where.academicYear = academicYear;

  const assignments = await db.classTeacherAssignment.findMany({
    where,
    include: {
      class: true,
      teacher: true,
      school: true
    }
  });

  return NextResponse.json({
    assignments,
    total: assignments.length
  });
}
