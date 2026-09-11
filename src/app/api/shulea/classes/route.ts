import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, getAuthorizedClassIds, rejectDemoMutation } from '@/lib/server-auth';

// Required for static export

// GET: List all classes (optional filter by schoolType, schoolId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolType = searchParams.get('schoolType');
    const schoolId = searchParams.get('schoolId');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }
    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role === 'SUPER_ADMIN' || actor.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const where: Record<string, unknown> = {};
    if (schoolType) where.schoolType = schoolType;
    where.schoolId = schoolId;
    if (actor.role === 'TEACHER') {
      const authorizedClassIds = await getAuthorizedClassIds(actor, { allowSubjectAssignment: true });
      // null means the actor can view all classes in the school (including a
      // read-only demo account); an empty array means no assigned classes.
      if (authorizedClassIds && authorizedClassIds.length === 0) return NextResponse.json({ classes: [] });
      if (authorizedClassIds) where.id = { in: authorizedClassIds };
    }

    const classes = await db.class.findMany({
      where,
      include: {
        school: { select: { name: true, schoolType: true } },
        classTeacher: { select: { name: true, shortName: true } },
        _count: {
          select: {
            students: true,
            subjects: true,
            exams: true,
          },
        },
      },
      orderBy: [{ schoolType: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ classes });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 });
  }
}

// POST: Create a new class
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SCHOOL_ADMIN') return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
    const body = await request.json();
    const {
      name,
      stream,
      fullName,
      schoolType,
      classTeacherId,
      schoolId,
      academicYear,
      term,
    } = body;

    if (!name || !fullName || !schoolType || !schoolId) {
      return NextResponse.json(
        { error: 'Name, full name, school type, and school ID are required' },
        { status: 400 }
      );
    }
    if (actor.schoolId !== schoolId) return NextResponse.json({ error: 'Cross-school class access denied' }, { status: 403 })

    const classRecord = await db.class.create({
      data: {
        name,
        stream: stream || null,
        fullName,
        schoolType,
        classTeacherId: classTeacherId || null,
        schoolId,
        academicYear: academicYear || null,
        term: term || null,
      },
      include: {
        school: { select: { name: true } },
        classTeacher: { select: { name: true } },
      },
    });

    return NextResponse.json({
      message: 'Class created successfully',
      class: classRecord,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating class:', error);
    return NextResponse.json({ error: 'Failed to create class' }, { status: 500 });
  }
}

// PUT: Update a class
export async function PUT(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SCHOOL_ADMIN') return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
    const body = await request.json();
    const { id, name, stream, fullName, schoolType, classTeacherId, academicYear, term } = body;

    if (!id) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
    }

    const existing = await db.class.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    if (existing.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Cross-school class access denied' }, { status: 403 })

    const classRecord = await db.class.update({
      where: { id },
      data: {
        name: name ?? undefined,
        stream: stream !== undefined ? stream : undefined,
        fullName: fullName ?? undefined,
        schoolType: schoolType ?? undefined,
        classTeacherId: classTeacherId !== undefined ? classTeacherId : undefined,
        academicYear: academicYear !== undefined ? academicYear : undefined,
        term: term !== undefined ? term : undefined,
      },
      include: {
        school: { select: { name: true } },
        classTeacher: { select: { name: true } },
      },
    });

    return NextResponse.json({
      message: 'Class updated successfully',
      class: classRecord,
    });
  } catch (error) {
    console.error('Error updating class:', error);
    return NextResponse.json({ error: 'Failed to update class' }, { status: 500 });
  }
}

// DELETE: Delete a class
export async function DELETE(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SCHOOL_ADMIN') return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
    }

    const existing = await db.class.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    if (existing.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Cross-school class access denied' }, { status: 403 })

    // Class has dependent academic records without database-level cascades.
    // Remove them in dependency order so PostgreSQL does not return a generic
    // foreign-key HTTP 500 to the administrator.
    await db.$transaction(async (tx) => {
      await tx.marksEntry.deleteMany({ where: { OR: [{ student: { classId: id } }, { classSubject: { classId: id } }, { exam: { classId: id } }] } })
      await tx.studentResult.deleteMany({ where: { classId: id } })
      await tx.attendance.deleteMany({ where: { classId: id } })
      await tx.tabia.deleteMany({ where: { classId: id } })
      await tx.exam.deleteMany({ where: { classId: id } })
      await tx.teacherSubject.deleteMany({ where: { classId: id } })
      await tx.classTeacherAssignment.deleteMany({ where: { classId: id } })
      await tx.classSubject.deleteMany({ where: { classId: id } })
      await tx.student.deleteMany({ where: { classId: id } })
      await tx.class.delete({ where: { id } })
    })

    return NextResponse.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Error deleting class:', error);
    return NextResponse.json({ error: 'Failed to delete class' }, { status: 500 });
  }
}
