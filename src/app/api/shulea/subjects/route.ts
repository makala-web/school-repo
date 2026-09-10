import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SubjectRepository } from '@/repositories/SubjectRepository';
import { ConnectionManager } from '@/services/database/ConnectionManager';
import { getAuthenticatedUser, rejectDemoMutation } from '@/lib/server-auth';
import { getMasterSubjects, getMasterSubjectNames } from '@/lib/subject-catalogue';

// Required for static export

// GET: List subjects (optional filter by schoolType, schoolId)
// Also supports action=class-subjects to get subjects for a specific class
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'class-subjects') {
      return await handleGetClassSubjects(request);
    }

    const schoolType = searchParams.get('schoolType') as 'PRIMARY' | 'SECONDARY' | undefined;
    const schoolId = searchParams.get('schoolId') || undefined;
    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role === 'SUPER_ADMIN' || !actor.schoolId || (schoolId && schoolId !== actor.schoolId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const school = await (await import('@/lib/db')).db.school.findUnique({
      where: { id: actor.schoolId },
      select: { schoolType: true, isDemo: true },
    })
    const effectiveSchoolType = (school?.schoolType === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY') as 'PRIMARY' | 'SECONDARY'

    // Normal schools receive the full master catalogue on first access. Demo
    // tenants stay read-only and are already seeded by the demo provisioner.
    if (!school?.isDemo && actor.role === 'SCHOOL_ADMIN') {
      const existing = await SubjectRepository.getAll({ schoolId: actor.schoolId })
      const existingNames = new Set(existing.map(subject => subject.name.trim().toLowerCase()))
      for (const master of getMasterSubjects(effectiveSchoolType)) {
        if (existingNames.has(master.name.toLowerCase())) continue
        await SubjectRepository.create({
          name: master.name,
          shortName: master.shortName,
          schoolType: master.schoolType,
          schoolId: actor.schoolId,
        })
        existingNames.add(master.name.toLowerCase())
      }
    }

    const subjects = await SubjectRepository.getAll({ schoolId: actor.schoolId, schoolType });
    const masterNames = getMasterSubjectNames(effectiveSchoolType)

    return NextResponse.json({
      subjects: subjects.map(subject => ({
        ...subject,
        source: masterNames.has(subject.name.trim().toLowerCase()) ? 'MASTER' : 'CUSTOM',
      })),
      catalogue: getMasterSubjects(effectiveSchoolType),
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch subjects';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function handleGetClassSubjects(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const classId = searchParams.get('classId');
  if (!classId) {
    return NextResponse.json({ error: 'classId is required for class-subjects' }, { status: 400 });
  }

  try {
    const { db } = await import('@/lib/db');
    const actor = await getAuthenticatedUser(request)
    const classRecord = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } })
    if (!actor || !classRecord || actor.role === 'SUPER_ADMIN' || actor.schoolId !== classRecord.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    const classSubjects = await db.classSubject.findMany({
      where: { classId },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            shortName: true,
            schoolType: true,
          },
        },
      },
      orderBy: {
        subject: {
          name: 'asc',
        },
      },
    });

    const formattedClassSubjects = classSubjects.map((cs: any) => ({
      id: cs.id,
      classId: cs.classId,
      subjectId: cs.subject.id,
      subject: {
        id: cs.subject.id,
        name: cs.subject.name,
        shortName: cs.subject.shortName,
        schoolType: cs.subject.schoolType,
      },
      createdAt: cs.createdAt.toISOString(),
    }));

    return NextResponse.json({ classSubjects: formattedClassSubjects });
  } catch (error) {
    console.error('Error creating subject:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create subject';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST: Create subject or assign subjects to class
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
    }
    const body = await request.json();
    const { action } = body;

    if (body.schoolId && body.schoolId !== actor.schoolId) {
      return NextResponse.json({ error: 'Cross-school subject access denied' }, { status: 403 })
    }
    if (action === 'assign-to-class') {
      const classRecord = await (await import('@/lib/db')).db.class.findUnique({ where: { id: body.classId }, select: { schoolId: true } })
      if (!classRecord || classRecord.schoolId !== actor.schoolId) {
        return NextResponse.json({ error: 'Class does not belong to your school' }, { status: 403 })
      }
      const subjectIds = Array.isArray(body.subjectIds) ? body.subjectIds : []
      const subjectCount = await (await import('@/lib/db')).db.subject.count({
        where: { id: { in: subjectIds }, schoolId: actor.schoolId },
      })
      if (subjectCount !== subjectIds.length) {
        return NextResponse.json({ error: 'One or more subjects do not belong to your school' }, { status: 403 })
      }
    }

    if (action === 'assign-to-class') {
      return await handleAssignToClass(body);
    }

    // Default: create new subject
    return await handleCreateSubject(body);
  } catch (error) {
    console.error('Error in POST /api/shulea/subjects:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process request';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function handleCreateSubject(body: {
  name: string;
  shortName?: string;
  schoolType: string;
  schoolId: string;
}) {
  console.log('[SUBJECT] Creating subject:', body.name, 'Type:', body.schoolType, 'School:', body.schoolId);

  const { name, shortName, schoolType, schoolId } = body;

  if (!name || !schoolType || !schoolId) {
    console.log('[SUBJECT] Create failed: Missing required fields');
    return NextResponse.json({ error: 'Name, school type, and school ID are required' }, { status: 400 });
  }

  if (!['PRIMARY', 'SECONDARY', 'BOTH'].includes(schoolType)) {
    console.log('[SUBJECT] Create failed: Invalid school type:', schoolType);
    return NextResponse.json({ error: 'School type must be PRIMARY, SECONDARY, or BOTH' }, { status: 400 });
  }

  try {
    const subject = await SubjectRepository.create({
      name,
      shortName: shortName || undefined,
      schoolType: schoolType as 'PRIMARY' | 'SECONDARY' | 'BOTH',
      schoolId,
    });

    console.log('[SUBJECT] Subject created successfully:', subject.id);
    return NextResponse.json({
      message: 'Subject created successfully',
      subject,
    }, { status: 201 });
  } catch (error) {
    console.error('[SUBJECT] Create error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create subject';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function handleAssignToClass(body: {
  classId: string;
  subjectIds: string[];
}) {
  console.log('[SUBJECT] Assigning subjects to class:', body.classId, 'Subject count:', body.subjectIds?.length);

  const { classId, subjectIds } = body;

  if (!classId || !subjectIds || !Array.isArray(subjectIds)) {
    console.log('[SUBJECT] Assign failed: Missing required fields');
    return NextResponse.json(
      { error: 'Class ID and subject IDs array are required' },
      { status: 400 }
    );
  }

  try {
    // This route always runs on the server. Use Prisma here instead of the
    // device ConnectionManager: its SQLite `?` placeholders are not valid for
    // PostgreSQL and caused the production HTTP 500 during class assignment.
    const requestedSubjectIds = [...new Set(subjectIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    const existing = await db.classSubject.findMany({
      where: { classId },
      select: { subjectId: true },
    })

    const existingSubjectIds = existing.map(row => row.subjectId);
    const toRemove = existingSubjectIds.filter(id => !requestedSubjectIds.includes(id));
    const toAdd = requestedSubjectIds.filter(id => !existingSubjectIds.includes(id));

    console.log('[SUBJECT] To add:', toAdd.length, 'To remove:', toRemove.length);

    await db.$transaction(async tx => {
      if (toRemove.length) {
        await tx.classSubject.deleteMany({
          where: { classId, subjectId: { in: toRemove } },
        })
      }
      if (toAdd.length) {
        await tx.classSubject.createMany({
          data: toAdd.map(subjectId => ({ classId, subjectId })),
          skipDuplicates: true,
        })
      }
    })

    const classSubjects = await db.classSubject.findMany({
      where: { classId },
      include: { subject: { select: { id: true, name: true, shortName: true, schoolType: true } } },
      orderBy: { subject: { name: 'asc' } },
    })

    const formattedClassSubjects = classSubjects.map(row => ({
      id: row.id,
      classId: row.classId,
      subjectId: row.subjectId,
      subject: row.subject,
      createdAt: row.createdAt.toISOString(),
    }));

    console.log('[SUBJECT] Subjects assigned successfully');
    return NextResponse.json({
      message: 'Subjects assigned successfully',
      classSubjects: formattedClassSubjects,
      added: toAdd.length,
      removed: toRemove.length,
    });
  } catch (error) {
    console.error('[SUBJECT] Assign error:', error);
    return NextResponse.json({ error: 'Failed to assign subjects. Please try again.' }, { status: 500 });
  }
}

// PUT: Update a subject
export async function PUT(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SCHOOL_ADMIN') return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
    const body = await request.json();
    const { id, name, shortName, schoolType } = body;

    if (!id) {
      return NextResponse.json({ error: 'Subject ID is required' }, { status: 400 });
    }

    const existing = await SubjectRepository.getById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }
    if (existing.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Cross-school subject access denied' }, { status: 403 })

    const subject = await SubjectRepository.update({
      id,
      name,
      shortName: shortName !== undefined ? shortName : undefined,
      schoolType: schoolType as 'PRIMARY' | 'SECONDARY' | 'BOTH' | undefined,
    });

    return NextResponse.json({
      message: 'Subject updated successfully',
      subject,
    });
  } catch (error) {
    console.error('Error updating subject:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update subject';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE: Delete a subject
export async function DELETE(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SCHOOL_ADMIN') return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Subject ID is required' }, { status: 400 });
    }

    const existing = await SubjectRepository.getById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }
    if (existing.schoolId !== actor.schoolId) return NextResponse.json({ error: 'Cross-school subject access denied' }, { status: 403 })

    await SubjectRepository.delete(id);

    return NextResponse.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete subject';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
