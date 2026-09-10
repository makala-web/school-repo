import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

/**
 * GET /api/shulea/teacher-classes
 * Get all classes and data for which a teacher is assigned
 * Used to automatically filter the dashboard based on class teacher assignments
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teacherId = searchParams.get('teacherId');
    const schoolId = searchParams.get('schoolId');
    const academicYear = searchParams.get('academicYear');
    const actorUserId = searchParams.get('actorUserId');

    if (!teacherId || !schoolId || !actorUserId) {
      return NextResponse.json(
        { error: 'Teacher ID, school ID, and actor ID are required' },
        { status: 400 }
      );
    }

    // The session cookie is the authority. actorUserId is retained only for
    // compatibility with older clients and is never trusted by itself.
    const actor = await getAuthenticatedUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (actorUserId !== actor.id) {
      return NextResponse.json({ error: 'Session user mismatch' }, { status: 403 });
    }

    // Only teacher themselves or super admin/school admin can view
    const teacher = await db.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true, schoolId: true, userId: true, user: { select: { email: true } } }
    });

    if (!teacher || teacher.schoolId !== schoolId) {
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 404 }
      );
    }

    const isAuthorized =
      actor.role === 'SUPER_ADMIN' ||
      (actor.role === 'SCHOOL_ADMIN' && actor.schoolId === schoolId) ||
      (actor.role === 'TEACHER' && actor.id === teacher.userId);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get class teacher assignments (one-to-many relationship)
    const assignments = await db.classTeacherAssignment.findMany({
      where: {
        teacherId,
        schoolId,
        status: 'ACTIVE',
        ...(academicYear && { academicYear })
      },
      include: {
        class: {
          include: {
            students: true,
            subjects: { include: { subject: true } },
            exams: true
          }
        }
      }
    });

    // Get subject assignments (for non-class-teacher subjects)
    const subjectAssignments = await db.teacherSubject.findMany({
      where: { teacherId },
      include: {
        class: true,
        subject: true
      }
    });

    // Prepare response
    const classTeacherClasses = assignments.map(a => ({
      id: a.class.id,
      name: a.class.name,
      fullName: a.class.fullName,
      studentCount: a.class.students.length,
      role: 'CLASS_TEACHER' as const,
      startDate: a.startDate
    }));

    const subjectOnlyClasses = subjectAssignments
      .filter(sa => !assignments.some(a => a.classId === sa.classId)) // Exclude already listed classes
      .map(sa => ({
        id: sa.class.id,
        name: sa.class.name,
        fullName: sa.class.fullName,
        subject: sa.subject.name,
        studentCount: 0, // Will need to fetch separately if needed
        role: 'SUBJECT_TEACHER' as const
      }));

    // Get head teacher status
    const schoolLeadership = await db.schoolLeadership.findUnique({
      where: { schoolId }
    });

    const isHeadTeacher = schoolLeadership?.headTeacherId === teacherId;

    return NextResponse.json({
      teacher: {
        id: teacher.id,
        name: teacher.name,
        schoolId: teacher.schoolId,
        isHeadTeacher,
        email: teacher.user?.email
      },
      classTeacherAssignments: classTeacherClasses,
      subjectOnlyAssignments: subjectOnlyClasses,
      totalClasses: classTeacherClasses.length + subjectOnlyClasses.length,
      isMultiClassTeacher: classTeacherClasses.length > 1
    });
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teacher classes' },
      { status: 500 }
    );
  }
}
