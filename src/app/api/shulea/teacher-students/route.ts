import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

/**
 * GET /api/shulea/teacher-students
 * Get students that a teacher is authorized to manage
 * For class teachers: returns students in their assigned class(es)
 * For subject teachers: returns students in their subject class(es)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teacherId = searchParams.get('teacherId');
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const actorUserId = searchParams.get('actorUserId');
    const academicYear = searchParams.get('academicYear');

    if (!teacherId || !schoolId || !actorUserId) {
      return NextResponse.json(
        { error: 'Teacher ID, school ID, and actor ID are required' },
        { status: 400 }
      );
    }

    // Verify actor
    const actor = await getAuthenticatedUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (actorUserId !== actor.id) {
      return NextResponse.json({ error: 'Session user mismatch' }, { status: 403 });
    }

    const teacher = await db.teacher.findUnique({
      where: { id: teacherId }
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

    if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Cross-school access denied' }, { status: 403 });
    }

    // Build filter for authorized classes
    let authorizedClassIds: string[] = [];

    if (classId) {
      // If specific classId requested, verify teacher has access
      const classRecord = await db.class.findUnique({
        where: { id: classId }
      });

      if (!classRecord || classRecord.schoolId !== schoolId) {
        return NextResponse.json(
          { error: 'Class not found' },
          { status: 404 }
        );
      }

      // Check if teacher is assigned to this class
      const isAssigned = await db.classTeacherAssignment.findFirst({
        where: {
          teacherId,
          classId,
          status: 'ACTIVE'
        }
      });

      if (!isAssigned) {
        const isSubjectTeacher = await db.teacherSubject.findFirst({
          where: { teacherId, classId }
        });

        if (!isSubjectTeacher) {
          return NextResponse.json(
            { error: 'Teacher not assigned to this class' },
            { status: 403 }
          );
        }
      }

      authorizedClassIds = [classId];
    } else {
      // Get all classes where teacher is assigned (as class teacher or subject teacher)
      const classTeacherAssignments = await db.classTeacherAssignment.findMany({
        where: {
          teacherId,
          schoolId,
          status: 'ACTIVE',
          ...(academicYear && { academicYear })
        },
        select: { classId: true }
      });

      const subjectAssignments = await db.teacherSubject.findMany({
        where: { teacherId },
        select: { classId: true }
      });

      authorizedClassIds = [
        ...classTeacherAssignments.map(a => a.classId),
        ...subjectAssignments.map(a => a.classId)
      ];

      // Remove duplicates
      authorizedClassIds = [...new Set(authorizedClassIds)];
    }

    if (authorizedClassIds.length === 0) {
      return NextResponse.json({
        students: [],
        totalCount: 0,
        authorizedClasses: [],
        message: 'Teacher has no authorized classes'
      });
    }

    // Get students in authorized classes
    const students = await db.student.findMany({
      where: {
        schoolId,
        classId: { in: authorizedClassIds },
        status: 'ACTIVE'
      },
      include: {
        class: true,
        marks: {
          include: { exam: true, classSubject: { include: { subject: true } } }
        },
        attendance: true,
        results: true
      },
      orderBy: [{ class: { name: 'asc' } }, { fullName: 'asc' }]
    });

    // Get class details for authorized classes
    const authorizedClasses = await db.class.findMany({
      where: { id: { in: authorizedClassIds } },
      select: {
        id: true,
        name: true,
        fullName: true
      }
    });

    return NextResponse.json({
      students,
      totalCount: students.length,
      authorizedClasses,
      isMultiClass: authorizedClassIds.length > 1
    });
  } catch (error) {
    console.error('Error fetching teacher students:', error);
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    );
  }
}
