import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

/**
 * GET /api/shulea/teacher-results
 * Get results that a teacher is authorized to view/manage
 * Class teachers can see all results for their class
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teacherId = searchParams.get('teacherId');
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const examId = searchParams.get('examId');
    const actorUserId = searchParams.get('actorUserId');

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

    // Get authorized class IDs for this teacher
    let authorizedClassIds: string[] = [];

    if (classId) {
      // Verify access to specific class
      const classRecord = await db.class.findUnique({
        where: { id: classId }
      });

      if (!classRecord || classRecord.schoolId !== schoolId) {
        return NextResponse.json(
          { error: 'Class not found' },
          { status: 404 }
        );
      }

      // Check if teacher is class teacher for this class
      const classTeacherAssignment = await db.classTeacherAssignment.findFirst({
        where: {
          teacherId,
          classId,
          status: 'ACTIVE'
        }
      });

      if (!classTeacherAssignment) {
        return NextResponse.json(
          { error: 'Teacher not assigned as class teacher for this class' },
          { status: 403 }
        );
      }

      authorizedClassIds = [classId];
    } else {
      // Get all classes where teacher is CLASS_TEACHER (not just subject teacher)
      const assignments = await db.classTeacherAssignment.findMany({
        where: {
          teacherId,
          schoolId,
          status: 'ACTIVE'
        },
        select: { classId: true }
      });

      authorizedClassIds = assignments.map(a => a.classId);
    }

    if (authorizedClassIds.length === 0) {
      return NextResponse.json({
        results: [],
        totalCount: 0,
        message: 'Teacher has no authorized classes'
      });
    }

    // Build query for results
    const where: any = {
      classId: { in: authorizedClassIds }
    };

    if (examId) {
      where.examId = examId;
    }

    const results = await db.studentResult.findMany({
      where,
      include: {
        student: true,
        exam: true,
        class: true
      },
      orderBy: [{ class: { name: 'asc' } }, { student: { fullName: 'asc' } }]
    });

    return NextResponse.json({
      results,
      totalCount: results.length,
      authorizedClasses: authorizedClassIds
    });
  } catch (error) {
    console.error('Error fetching teacher results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}
