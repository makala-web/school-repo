import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { canAccessClass, getAuthenticatedUser, rejectDemoMutation } from '@/lib/server-auth';
import { recordSyncLedgerChanges } from '@/lib/sync-ledger';

type Actor = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;

async function validateTabiaTarget(actor: Actor, classId: string, studentId?: string, examId?: string) {
  if (actor.role === 'SUPER_ADMIN' || !actor.schoolId || !(await canAccessClass(actor, classId))) return false;
  const classRecord = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
  if (!classRecord || classRecord.schoolId !== actor.schoolId) return false;
  if (studentId) {
    const student = await db.student.findFirst({ where: { id: studentId, classId, schoolId: actor.schoolId }, select: { id: true } });
    if (!student) return false;
  }
  if (examId) {
    const exam = await db.exam.findFirst({ where: { id: examId, classId, schoolId: actor.schoolId }, select: { id: true } });
    if (!exam) return false;
  }
  return true;
}

// Required for static export

// GET: Get tabia records for a class+exam
export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const examId = searchParams.get('examId');
    const studentId = searchParams.get('studentId');

    if (!classId) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
    }
    if (!(await validateTabiaTarget(actor, classId, studentId || undefined, examId || undefined))) {
      return NextResponse.json({ error: 'You are not authorized to access Tabia for this class' }, { status: 403 });
    }

    const where: Record<string, unknown> = { classId, student: { schoolId: actor.schoolId } };
    if (examId) where.examId = examId;
    if (studentId) where.studentId = studentId;

    const tabia = await db.tabia.findMany({
      where,
      include: {
        student: {
          select: { id: true, fullName: true, gender: true, admissionNo: true },
        },
      },
      orderBy: [{ student: { fullName: 'asc' } }],
    });

    // If examId is provided, also return all active students
    let students: Array<{ id: string; fullName: string; gender: string; admissionNo: string | null }> = [];
    if (examId) {
      students = await db.student.findMany({
      where: { classId, schoolId: actor.schoolId || '', status: 'ACTIVE' },
        select: { id: true, fullName: true, gender: true, admissionNo: true },
        orderBy: { fullName: 'asc' },
      });
    }

    return NextResponse.json({ tabia, students });
  } catch (error) {
    console.error('Error fetching tabia:', error);
    return NextResponse.json({ error: 'Failed to fetch tabia records' }, { status: 500 });
  }
}

// POST: Save/update tabia record or bulk save
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request);
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = await request.json();
    const { action } = body;
    const operationId = request.headers.get('x-shulea-operation-id');

    if (action === 'bulk-save') {
      const records = Array.isArray(body.records) ? body.records : [];
      for (const record of records) {
        if (!record?.classId || !(await validateTabiaTarget(actor, String(record.classId), String(record.studentId || ''), record.examId ? String(record.examId) : undefined))) {
          return NextResponse.json({ error: 'One or more Tabia records are outside your assigned class' }, { status: 403 });
        }
      }
      return await handleBulkSave(body, actor.schoolId!, operationId);
    }

    if (!body.classId || !body.studentId || !(await validateTabiaTarget(actor, String(body.classId), String(body.studentId), body.examId ? String(body.examId) : undefined))) {
      return NextResponse.json({ error: 'You are not authorized to update Tabia for this student' }, { status: 403 });
    }
    return await handleSaveTabia(body, actor.schoolId!, operationId);
  } catch (error) {
    console.error('Error saving tabia:', error);
    return NextResponse.json({ error: 'Failed to save tabia' }, { status: 500 });
  }
}

async function handleSaveTabia(body: {
  studentId: string;
  classId: string;
  examId?: string;
  discipline?: string;
  hygiene?: string;
  hardWorking?: string;
  cooperation?: string;
  honesty?: string;
  leadership?: string;
  sports?: string;
}, schoolId: string, operationId?: string | null) {
  const { studentId, classId, examId, discipline, hygiene, hardWorking, cooperation, honesty, leadership, sports } = body;

  if (!studentId || !classId) {
    return NextResponse.json(
      { error: 'Student ID and class ID are required' },
      { status: 400 }
    );
  }

  const validGrades = ['A', 'B', 'C', 'D', 'E'];
  const characterFields = { discipline, hygiene, hardWorking, cooperation, honesty, leadership, sports };

  for (const [key, value] of Object.entries(characterFields)) {
    if (value && !validGrades.includes(value)) {
      return NextResponse.json(
        { error: `${key} must be one of: ${validGrades.join(', ')}` },
        { status: 400 }
      );
    }
  }

  // If examId is provided, use upsert with the unique constraint
  if (examId) {
    const record = await db.tabia.upsert({
      where: {
        studentId_classId_examId: {
          studentId,
          classId,
          examId,
        },
      },
      create: {
        studentId,
        classId,
        examId,
        discipline: discipline || null,
        hygiene: hygiene || null,
        hardWorking: hardWorking || null,
        cooperation: cooperation || null,
        honesty: honesty || null,
        leadership: leadership || null,
        sports: sports || null,
      },
      update: {
        discipline: discipline !== undefined ? discipline : undefined,
        hygiene: hygiene !== undefined ? hygiene : undefined,
        hardWorking: hardWorking !== undefined ? hardWorking : undefined,
        cooperation: cooperation !== undefined ? cooperation : undefined,
        honesty: honesty !== undefined ? honesty : undefined,
        leadership: leadership !== undefined ? leadership : undefined,
        sports: sports !== undefined ? sports : undefined,
      },
    });

    await recordSyncLedgerChanges(schoolId, [{ entityType: 'TABIA', entityId: record.id, payload: record }], operationId);

    return NextResponse.json({
      message: 'Tabia record saved successfully',
      tabia: record,
    });
  }

  // Without examId, create a new record
  const record = await db.tabia.create({
    data: {
      studentId,
      classId,
      examId: null,
      discipline: discipline || null,
      hygiene: hygiene || null,
      hardWorking: hardWorking || null,
      cooperation: cooperation || null,
      honesty: honesty || null,
      leadership: leadership || null,
      sports: sports || null,
    },
  });

  await recordSyncLedgerChanges(schoolId, [{ entityType: 'TABIA', entityId: record.id, payload: record }], operationId);

  return NextResponse.json({
    message: 'Tabia record saved successfully',
    tabia: record,
  }, { status: 201 });
}

async function handleBulkSave(body: {
  records: Array<{
    studentId: string;
    classId: string;
    examId?: string;
    discipline?: string;
    hygiene?: string;
    hardWorking?: string;
    cooperation?: string;
    honesty?: string;
    leadership?: string;
    sports?: string;
  }>;
}, schoolId: string, operationId?: string | null) {
  const { records } = body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'Records array is required' }, { status: 400 });
  }

  const results: Array<{
    id: string
    studentId: string
    classId: string
    examId: string | null
    discipline: string | null
    hygiene: string | null
    hardWorking: string | null
    cooperation: string | null
    honesty: string | null
    leadership: string | null
    sports: string | null
    createdAt: Date
    updatedAt: Date
  }> = [];

  for (const record of records) {
    if (!record.studentId || !record.classId) continue;

    if (record.examId) {
      const saved = await db.tabia.upsert({
        where: {
          studentId_classId_examId: {
            studentId: record.studentId,
            classId: record.classId,
            examId: record.examId,
          },
        },
        create: {
          studentId: record.studentId,
          classId: record.classId,
          examId: record.examId,
          discipline: record.discipline || null,
          hygiene: record.hygiene || null,
          hardWorking: record.hardWorking || null,
          cooperation: record.cooperation || null,
          honesty: record.honesty || null,
          leadership: record.leadership || null,
          sports: record.sports || null,
        },
        update: {
          discipline: record.discipline !== undefined ? record.discipline : undefined,
          hygiene: record.hygiene !== undefined ? record.hygiene : undefined,
          hardWorking: record.hardWorking !== undefined ? record.hardWorking : undefined,
          cooperation: record.cooperation !== undefined ? record.cooperation : undefined,
          honesty: record.honesty !== undefined ? record.honesty : undefined,
          leadership: record.leadership !== undefined ? record.leadership : undefined,
          sports: record.sports !== undefined ? record.sports : undefined,
        },
      });
      results.push(saved);
    } else {
      const saved = await db.tabia.create({
        data: {
          studentId: record.studentId,
          classId: record.classId,
          examId: null,
          discipline: record.discipline || null,
          hygiene: record.hygiene || null,
          hardWorking: record.hardWorking || null,
          cooperation: record.cooperation || null,
          honesty: record.honesty || null,
          leadership: record.leadership || null,
          sports: record.sports || null,
        },
      });
      results.push(saved);
    }
  }

  await recordSyncLedgerChanges(schoolId, results.map(record => ({ entityType: 'TABIA', entityId: record.id, payload: record })), operationId);

  return NextResponse.json({
    message: `${results.length} tabia records saved successfully`,
    saved: results.length,
  });
}
