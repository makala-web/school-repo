import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rejectDemoMutation } from '@/lib/server-auth';

// Required for static export

// GET: Get tabia records for a class+exam
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const examId = searchParams.get('examId');
    const studentId = searchParams.get('studentId');

    if (!classId) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { classId };
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
        where: { classId, status: 'ACTIVE' },
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
    const body = await request.json();
    const { action } = body;

    if (action === 'bulk-save') {
      return await handleBulkSave(body);
    }

    return await handleSaveTabia(body);
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
}) {
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
}) {
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

  return NextResponse.json({
    message: `${results.length} tabia records saved successfully`,
    saved: results.length,
  });
}
