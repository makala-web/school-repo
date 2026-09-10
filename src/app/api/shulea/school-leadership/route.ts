import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const schoolId = request.nextUrl.searchParams.get('schoolId');
    const actorUserId = request.nextUrl.searchParams.get('actorUserId');

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

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

    const leadership = await db.schoolLeadership.findUnique({
      where: { schoolId },
      include: {
        headTeacher: {
          select: { id: true, name: true, shortName: true, sign: true, phone: true, schoolId: true, userId: true }
        }
      }
    });

    const teachers = await db.teacher.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({
      schoolId,
      currentHeadTeacherId: leadership?.headTeacherId || null,
      currentHeadTeacher: leadership?.headTeacher || null,
      teachers,
      status: leadership?.status || 'ACTIVE'
    });
  } catch (error) {
    console.error('Error fetching school leadership:', error);
    return NextResponse.json({ error: 'Failed to fetch school leadership' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, actorUserId, schoolId, teacherId, startDate } = body;

    if (!schoolId) {
      return NextResponse.json({ error: 'School is required' }, { status: 400 });
    }

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

    if (action === 'clear') {
      const leadership = await db.schoolLeadership.upsert({
        where: { schoolId },
        update: {
          headTeacherId: null,
          status: 'INACTIVE',
          endDate: new Date().toISOString().slice(0, 10)
        },
        create: {
          schoolId,
          headTeacherId: null,
          status: 'INACTIVE',
          startDate: null,
          endDate: new Date().toISOString().slice(0, 10)
        }
      });

      await db.school.update({
        where: { id: schoolId },
        data: { headTeacherName: null }
      });

      return NextResponse.json({ message: 'Head teacher cleared successfully', leadership });
    }

    if (action === 'assign' || action === 'set-head-teacher') {
      if (!teacherId) {
        return NextResponse.json({ error: 'Teacher is required' }, { status: 400 });
      }

      const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher || teacher.schoolId !== schoolId) {
        return NextResponse.json({ error: 'Teacher not found for this school' }, { status: 404 });
      }

      const leadership = await db.schoolLeadership.upsert({
        where: { schoolId },
        update: {
          headTeacherId: teacherId,
          status: 'ACTIVE',
          startDate: startDate || new Date().toISOString().slice(0, 10),
          endDate: null
        },
        create: {
          schoolId,
          headTeacherId: teacherId,
          status: 'ACTIVE',
          startDate: startDate || new Date().toISOString().slice(0, 10),
          endDate: null
        }
      });

      await db.school.update({
        where: { id: schoolId },
        data: {
          headTeacherName: teacher.name,
          headTeacherSign: teacher.sign || null,
        }
      });

      await db.auditLog.create({
        data: {
          action: 'HEAD_TEACHER_ASSIGNED',
          entityType: 'SCHOOL_LEADERSHIP',
          entityId: leadership.id,
          schoolId,
          userId: actor.id,
          details: `${teacher.name} assigned as head teacher`
        }
      });

      return NextResponse.json({
        message: 'Head teacher assigned successfully',
        leadership
      }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating school leadership:', error);
    return NextResponse.json({ error: 'Failed to update school leadership' }, { status: 500 });
  }
}
