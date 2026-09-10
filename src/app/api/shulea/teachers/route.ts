import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, rejectDemoMutation } from '@/lib/server-auth';

// GET: List teachers (optional filter by schoolId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const actor = await getAuthenticatedUser(request);
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (actor.role === 'SUPER_ADMIN' || !schoolId || actor.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const where: Record<string, unknown> = {};
    if (schoolId) where.schoolId = schoolId;

    const teachers = await db.teacher.findMany({
      where,
      include: {
        school: { select: { name: true } },
        subjectClasses: {
          include: {
            subject: { select: { name: true, shortName: true } },
            class: { select: { name: true, fullName: true } },
          },
        },
        classAssignments: {
          select: { id: true, name: true, fullName: true },
        },
        _count: {
          select: { subjectClasses: true },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    return NextResponse.json({ teachers });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return NextResponse.json({ error: 'Failed to fetch teachers' }, { status: 500 });
  }
}

// POST: Create a teacher or assign a teacher to subject+class
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SCHOOL_ADMIN') return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
    const body = await request.json();
    const { action } = body;
    if (!body.schoolId || actor.schoolId !== body.schoolId) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const teacher = body.teacherId ? await db.teacher.findUnique({ where: { id: body.teacherId }, select: { schoolId: true } }) : null
    if (body.teacherId && (!teacher || teacher.schoolId !== actor.schoolId)) return NextResponse.json({ error: 'Teacher does not belong to your school' }, { status: 403 })
    if (body.classId) {
      const classRecord = await db.class.findUnique({ where: { id: body.classId }, select: { schoolId: true } })
      if (!classRecord || classRecord.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Class does not belong to your school' }, { status: 403 })
    }
    if (body.subjectId) {
      const subject = await db.subject.findUnique({ where: { id: body.subjectId }, select: { schoolId: true } })
      if (!subject || subject.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Subject does not belong to your school' }, { status: 403 })
    }

    if (action === 'assign-subject') {
      return await handleAssignSubject(body);
    }

    if (action === 'remove-assignment') {
      return await handleRemoveAssignment(body, actor);
    }

    if (action === 'update-assignment') {
      return await handleUpdateAssignment(body, actor);
    }

    return await handleCreateTeacher(body);
  } catch (error) {
    console.error('Error creating teacher:', error);
    return NextResponse.json({ error: 'Failed to create teacher' }, { status: 500 });
  }
}

async function handleCreateTeacher(body: {
  name: string;
  shortName?: string;
  sign?: string;
  phone?: string;
  schoolId: string;
  userId?: string;
}) {
  const { name, shortName, sign, phone, schoolId, userId } = body;

  if (!name || !schoolId) {
    return NextResponse.json(
      { error: 'Name and school ID are required' },
      { status: 400 }
    );
  }

  const teacher = await db.teacher.create({
    data: {
      name,
      shortName: shortName || null,
      sign: sign || null,
      phone: phone || null,
      schoolId,
      userId: userId || null,
    },
    include: {
      school: { select: { name: true } },
    },
  });

  return NextResponse.json({
    message: 'Teacher created successfully',
    teacher,
  }, { status: 201 });
}

async function handleAssignSubject(body: {
  teacherId: string;
  subjectId: string;
  classId: string;
}) {
  const { teacherId, subjectId, classId } = body;

  if (!teacherId || !subjectId || !classId) {
    return NextResponse.json(
      { error: 'Teacher ID, subject ID, and class ID are required' },
      { status: 400 }
    );
  }

  // Check if assignment already exists
  const existing = await db.teacherSubject.findUnique({
    where: {
      teacherId_subjectId_classId: {
        teacherId,
        subjectId,
        classId,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Teacher is already assigned to this subject and class' },
      { status: 409 }
    );
  }

  const assignment = await db.teacherSubject.create({
    data: { teacherId, subjectId, classId },
    include: {
      teacher: { select: { name: true } },
      subject: { select: { name: true } },
      class: { select: { fullName: true } },
    },
  });

  return NextResponse.json({
    message: 'Teacher assigned to subject successfully',
    assignment,
  }, { status: 201 });
}

async function handleRemoveAssignment(body: {
  assignmentId: string;
}, actor: { schoolId?: string | null }) {
  const { assignmentId } = body;

  if (!assignmentId) {
    return NextResponse.json(
      { error: 'Assignment ID is required' },
      { status: 400 }
    );
  }

  const existing = await db.teacherSubject.findUnique({
    where: { id: assignmentId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: 'Assignment not found' },
      { status: 404 }
    );
  }
  const teacher = await db.teacher.findUnique({ where: { id: existing.teacherId }, select: { schoolId: true } })
  if (!teacher || teacher.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Assignment access denied' }, { status: 403 })

  await db.teacherSubject.delete({ where: { id: assignmentId } });

  return NextResponse.json({
    message: 'Assignment removed successfully',
  });
}

async function handleUpdateAssignment(body: {
  assignmentId: string;
  subjectId: string;
  classId: string;
}, actor: { schoolId?: string | null }) {
  const { assignmentId, subjectId, classId } = body;

  if (!assignmentId || !subjectId || !classId) {
    return NextResponse.json(
      { error: 'Assignment ID, subject ID, and class ID are required' },
      { status: 400 }
    );
  }

  const existing = await db.teacherSubject.findUnique({
    where: { id: assignmentId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: 'Assignment not found' },
      { status: 404 }
    );
  }
  const teacher = await db.teacher.findUnique({ where: { id: existing.teacherId }, select: { schoolId: true } })
  const targetClass = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } })
  const targetSubject = await db.subject.findUnique({ where: { id: subjectId }, select: { schoolId: true } })
  if (!teacher || teacher.schoolId !== actor.schoolId || !targetClass || targetClass.schoolId !== actor.schoolId || !targetSubject || targetSubject.schoolId !== actor.schoolId) {
    return NextResponse.json({ error: 'Assignment access denied' }, { status: 403 })
  }

  // Check if the new combination already exists (different assignment with same teacher+subject+class)
  const duplicate = await db.teacherSubject.findUnique({
    where: {
      teacherId_subjectId_classId: {
        teacherId: existing.teacherId,
        subjectId,
        classId,
      },
    },
  });

  if (duplicate && duplicate.id !== assignmentId) {
    return NextResponse.json(
      { error: 'Teacher is already assigned to this subject and class' },
      { status: 409 }
    );
  }

  const assignment = await db.teacherSubject.update({
    where: { id: assignmentId },
    data: { subjectId, classId },
    include: {
      teacher: { select: { name: true } },
      subject: { select: { name: true, shortName: true } },
      class: { select: { name: true, fullName: true } },
    },
  });

  return NextResponse.json({
    message: 'Assignment updated successfully',
    assignment,
  });
}

// PUT: Update a teacher
export async function PUT(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SCHOOL_ADMIN') return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
    const body = await request.json();
    const { id, name, shortName, sign, phone } = body;

    if (!id) {
      return NextResponse.json({ error: 'Teacher ID is required' }, { status: 400 });
    }

    const existing = await db.teacher.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }
    if (existing.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Cross-school teacher access denied' }, { status: 403 })

    const teacher = await db.teacher.update({
      where: { id },
      data: {
        name: name ?? undefined,
        shortName: shortName !== undefined ? shortName : undefined,
        sign: sign !== undefined ? sign : undefined,
        phone: phone !== undefined ? phone : undefined,
      },
    });

    return NextResponse.json({
      message: 'Teacher updated successfully',
      teacher,
    });
  } catch (error) {
    console.error('Error updating teacher:', error);
    return NextResponse.json({ error: 'Failed to update teacher' }, { status: 500 });
  }
}

// DELETE: Delete a teacher
export async function DELETE(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SCHOOL_ADMIN') return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Teacher ID is required' }, { status: 400 });
    }

    const existing = await db.teacher.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }
    if (existing.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Cross-school teacher access denied' }, { status: 403 })

    await db.teacher.delete({ where: { id } });

    return NextResponse.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    return NextResponse.json({ error: 'Failed to delete teacher' }, { status: 500 });
  }
}
