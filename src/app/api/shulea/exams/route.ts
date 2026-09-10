import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { canAccessClass, getAuthenticatedUser, getAuthorizedClassIds, rejectDemoMutation } from '@/lib/server-auth';

// Required for static export

// GET: List exams (optional filter by classId, schoolId, examType)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const schoolId = searchParams.get('schoolId');
    const examType = searchParams.get('examType');
    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Platform accounts cannot access academic records' }, { status: 403 })

    const where: Record<string, unknown> = {};
    if (classId) {
      if (!(await canAccessClass(actor, classId, { allowSubjectAssignment: true }))) {
        return NextResponse.json({ error: 'Teacher is not authorized for this class' }, { status: 403 })
      }
      where.classId = classId;
    }
    if (schoolId && schoolId !== actor.schoolId) return NextResponse.json({ error: 'Cross-school access denied' }, { status: 403 })
    if (schoolId) where.schoolId = schoolId;
    if (actor.role !== 'SUPER_ADMIN') where.schoolId = actor.schoolId || undefined;
    if (!classId && actor.role === 'TEACHER') {
      const authorizedClassIds = await getAuthorizedClassIds(actor, { allowSubjectAssignment: true });
      // An unassigned teacher should see a useful empty state, not an error toast.
      // null means the actor can view all classes in the school (for example,
      // a read-only demo account); an empty array means no assigned classes.
      if (authorizedClassIds && authorizedClassIds.length === 0) return NextResponse.json({ exams: [] });
      if (authorizedClassIds) where.classId = { in: authorizedClassIds };
    }
    if (examType) where.examType = examType;

    const exams = await db.exam.findMany({
      where,
      include: {
        class: { select: { name: true, fullName: true, schoolType: true } },
        school: { select: { name: true } },
        _count: {
          select: {
            marks: true,
            results: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return NextResponse.json({ exams });
  } catch (error) {
    console.error('Error fetching exams:', error);
    return NextResponse.json({ error: 'Failed to fetch exams' }, { status: 500 });
  }
}

// POST: Create an exam
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const body = await request.json();
    const {
      name,
      examType,
      classId,
      schoolId,
      academicYear,
      term,
      examDate,
    } = body;
    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role === 'SUPER_ADMIN' || !(await canAccessClass(actor, classId))) {
      return NextResponse.json({ error: 'You are not authorized to manage exams for this class' }, { status: 403 })
    }
    if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Cross-school access denied' }, { status: 403 })
    }

    if (!name || !examType || !classId || !schoolId || !academicYear || !term) {
      return NextResponse.json(
        { error: 'Name, exam type, class ID, school ID, academic year, and term are required' },
        { status: 400 }
      );
    }

    const validExamTypes = ['MIDTERM', 'MONTHLY', 'TERMINAL', 'ANNUAL'];
    if (!validExamTypes.includes(examType)) {
      return NextResponse.json(
        { error: `Exam type must be one of: ${validExamTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const validTerms = ['FIRST TERM', 'SECOND TERM', 'THIRD TERM'];
    if (!validTerms.includes(term)) {
      return NextResponse.json(
        { error: `Term must be one of: ${validTerms.join(', ')}` },
        { status: 400 }
      );
    }

    const exam = await db.exam.create({
      data: {
        name,
        examType,
        classId,
        schoolId,
        academicYear,
        term,
        examDate: examDate || null,
      },
      include: {
        class: { select: { name: true, fullName: true } },
      },
    });

    return NextResponse.json({
      message: 'Exam created successfully',
      exam,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating exam:', error);
    return NextResponse.json({ error: 'Failed to create exam' }, { status: 500 });
  }
}

// PUT: Update an exam
export async function PUT(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const body = await request.json();
    const { id, name, examType, academicYear, term, examDate } = body;

    if (!id) {
      return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
    }

    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }
    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role === 'SUPER_ADMIN' || !(await canAccessClass(actor, existing.classId))) {
      return NextResponse.json({ error: 'You are not authorized to manage this class exam' }, { status: 403 })
    }

    const exam = await db.exam.update({
      where: { id },
      data: {
        name: name ?? undefined,
        examType: examType ?? undefined,
        academicYear: academicYear ?? undefined,
        term: term ?? undefined,
        examDate: examDate !== undefined ? examDate : undefined,
      },
      include: {
        class: { select: { name: true, fullName: true } },
      },
    });

    return NextResponse.json({
      message: 'Exam updated successfully',
      exam,
    });
  } catch (error) {
    console.error('Error updating exam:', error);
    return NextResponse.json({ error: 'Failed to update exam' }, { status: 500 });
  }
}

// DELETE: Delete an exam
export async function DELETE(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
    }

    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }
    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role === 'SUPER_ADMIN' || !(await canAccessClass(actor, existing.classId))) {
      return NextResponse.json({ error: 'You are not authorized to manage this class exam' }, { status: 403 })
    }

    await db.exam.delete({ where: { id } });

    return NextResponse.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('Error deleting exam:', error);
    return NextResponse.json({ error: 'Failed to delete exam' }, { status: 500 });
  }
}
