import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { canAccessClass, getAuthenticatedUser, rejectDemoMutation } from '@/lib/server-auth';

// Required for static export

// Helper: Get grade from marks based on school type
function getGrade(marks: number, schoolType: string): string {
  if (schoolType === 'PRIMARY') {
    // PRIMARY (out of 50): A(41-50), B(31-40), C(21-30), D(11-20), E(0-10)
    if (marks >= 41) return 'A';
    if (marks >= 31) return 'B';
    if (marks >= 21) return 'C';
    if (marks >= 11) return 'D';
    return 'E';
  } else {
    // SECONDARY (out of 100): A(75-100), B(65-74), C(45-64), D(30-44), F(0-29)
    if (marks >= 75) return 'A';
    if (marks >= 65) return 'B';
    if (marks >= 45) return 'C';
    if (marks >= 30) return 'D';
    return 'F';
  }
}

// Helper: Get NECTA points for a grade (secondary only)
function getNectaPoints(grade: string): number {
  switch (grade) {
    case 'A': return 1;
    case 'B': return 2;
    case 'C': return 3;
    case 'D': return 4;
    case 'F': return 5;
    default: return 5;
  }
}

// Helper: Get division from total points (secondary, best 7 subjects)
// Standard NECTA division system
function getDivision(totalPoints: number, subjectCount: number): string {
  if (subjectCount === 0) return '0';
  if (totalPoints >= 7 && totalPoints <= 17) return 'I';
  if (totalPoints >= 18 && totalPoints <= 21) return 'II';
  if (totalPoints >= 22 && totalPoints <= 25) return 'III';
  if (totalPoints >= 26 && totalPoints <= 33) return 'IV';
  return '0';
}

// Helper: Get remarks for a grade
function getRemarks(grade: string): string {
  switch (grade) {
    case 'A': return 'Excellent';
    case 'B': return 'Very Good';
    case 'C': return 'Good';
    case 'D': return 'Satisfactory';
    case 'E': return 'Poor';
    case 'F': return 'Fail';
    default: return '';
  }
}

// GET: Get marks for a specific class+exam (with student details)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const examId = searchParams.get('examId');
    const subjectId = searchParams.get('subjectId');

    if (!classId || !examId) {
      return NextResponse.json(
        { error: 'Class ID and Exam ID are required' },
        { status: 400 }
      );
    }

    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (!(await canAccessClass(actor, classId, { allowSubjectAssignment: true }))) {
      return NextResponse.json({ error: 'Teacher is not authorized for this class' }, { status: 403 })
    }
    const examRecord = await db.exam.findUnique({ where: { id: examId }, select: { classId: true, schoolId: true } })
    if (!examRecord || examRecord.classId !== classId || (actor.schoolId && examRecord.schoolId !== actor.schoolId)) {
      return NextResponse.json({ error: 'Exam does not belong to the selected class' }, { status: 400 })
    }

    let subjectOnlyIds: string[] | null = null
    if (actor.role === 'TEACHER') {
      const teacher = await db.teacher.findUnique({ where: { userId: actor.id }, select: { id: true } })
      const classTeacher = teacher ? await db.classTeacherAssignment.findFirst({ where: { teacherId: teacher.id, classId, status: 'ACTIVE' }, select: { id: true } }) : null
      if (!classTeacher && teacher) {
        const assignments = await db.teacherSubject.findMany({ where: { teacherId: teacher.id, classId }, select: { subjectId: true } })
        subjectOnlyIds = assignments.map(item => item.subjectId)
        if (subjectId && !subjectOnlyIds.includes(subjectId)) {
          return NextResponse.json({ error: 'Teacher is not authorized for this subject' }, { status: 403 })
        }
        if (subjectOnlyIds.length === 0) return NextResponse.json({ error: 'Teacher has no subject assignment for this class' }, { status: 403 })
      }
    }

    // Get the class to determine school type
    const classRecord = await db.class.findUnique({
      where: { id: classId },
      include: {
        subjects: { include: { subject: true } },
      },
    });

    if (!classRecord) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Build the where clause for marks
    const where: Record<string, unknown> = { examId };
    if (subjectId) {
      // Filter by subject via classSubject
      const classSubject = await db.classSubject.findFirst({
        where: { classId, subjectId },
      });
      if (!classSubject) {
        return NextResponse.json({ error: 'The selected subject is not assigned to this class' }, { status: 400 });
      }
      where.classSubjectId = classSubject.id;
    } else {
      // Filter by class via classSubject
      const classSubjectIds = classRecord.subjects
        .filter(cs => !subjectOnlyIds || subjectOnlyIds.includes(cs.subjectId))
        .map(cs => cs.id);
      where.classSubjectId = { in: classSubjectIds };
    }

    const marks = await db.marksEntry.findMany({
      where,
      include: {
        student: {
          select: { id: true, fullName: true, gender: true, admissionNo: true },
        },
        classSubject: {
          include: { subject: { select: { id: true, name: true, shortName: true } } },
        },
      },
      orderBy: [{ student: { fullName: 'asc' } }],
    });

    // Get students in the class (for showing students without marks too)
    const students = await db.student.findMany({
      where: { classId, status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
    });

    return NextResponse.json({
      marks,
      students,
      classSubjects: classRecord.subjects.filter(cs => !subjectOnlyIds || subjectOnlyIds.includes(cs.subjectId)).map(cs => ({
        id: cs.id,
        subjectId: cs.subject.id,
        subjectName: cs.subject.name,
        shortName: cs.subject.shortName,
      })),
      schoolType: classRecord.schoolType,
    });
  } catch (error) {
    console.error('Error fetching marks:', error);
    return NextResponse.json({ error: 'Failed to fetch marks' }, { status: 500 });
  }
}

// POST: Save/update marks or compute results
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const body = await request.json();
    const { action } = body;

    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Platform accounts cannot modify academic records' }, { status: 403 })

    let targetClassId = body.classId as string | undefined
    if (!targetClassId && body.classSubjectId) {
      const classSubject = await db.classSubject.findUnique({ where: { id: body.classSubjectId }, select: { classId: true } })
      targetClassId = classSubject?.classId
    }
    if (!targetClassId && body.studentId) {
      const student = await db.student.findUnique({ where: { id: body.studentId }, select: { classId: true } })
      targetClassId = student?.classId
    }
    if (!targetClassId || !(await canAccessClass(actor, targetClassId, { allowSubjectAssignment: true }))) {
      return NextResponse.json({ error: 'Teacher is not authorized to manage marks for this class' }, { status: 403 })
    }
    if (body.examId) {
      const exam = await db.exam.findUnique({ where: { id: body.examId }, select: { classId: true, schoolId: true } })
      if (!exam || exam.classId !== targetClassId || (actor.schoolId && exam.schoolId !== actor.schoolId)) {
        return NextResponse.json({ error: 'Exam does not belong to the selected class' }, { status: 400 })
      }
    }
    if (actor.role === 'TEACHER' && body.classSubjectId) {
      const teacher = await db.teacher.findUnique({ where: { userId: actor.id }, select: { id: true } })
      const classTeacher = teacher ? await db.classTeacherAssignment.findFirst({ where: { teacherId: teacher.id, classId: targetClassId, status: 'ACTIVE' }, select: { id: true } }) : null
      if (!classTeacher) {
        const classSubject = await db.classSubject.findUnique({ where: { id: body.classSubjectId }, select: { subjectId: true, classId: true } })
        const subjectAccess = teacher && classSubject ? await db.teacherSubject.findFirst({ where: { teacherId: teacher.id, classId: targetClassId, subjectId: classSubject.subjectId } }) : null
        if (!subjectAccess || classSubject?.classId !== targetClassId) return NextResponse.json({ error: 'Teacher is not authorized for this subject' }, { status: 403 })
      }
    }

    if (action === 'bulk-save') {
      return await handleBulkSave(body, actor);
    }

    if (action === 'compute-results') {
      if (actor.role === 'TEACHER') {
        const teacher = await db.teacher.findUnique({ where: { userId: actor.id }, select: { id: true } })
        const classTeacher = teacher ? await db.classTeacherAssignment.findFirst({ where: { teacherId: teacher.id, classId: body.classId, status: 'ACTIVE' }, select: { id: true } }) : null
        if (!classTeacher) return NextResponse.json({ error: 'Only the class teacher or school administrator can compute class results' }, { status: 403 })
      }
      return await handleComputeResults(body);
    }

    return await handleSaveMark(body);
  } catch (error) {
    console.error('Error saving marks:', error);
    return NextResponse.json({ error: 'Failed to save marks' }, { status: 500 });
  }
}

async function handleSaveMark(body: {
  studentId: string;
  classSubjectId: string;
  examId: string;
  marks?: number | null;
  grade?: string;
  remarks?: string;
}) {
  const { studentId, classSubjectId, examId, marks, grade, remarks } = body;

  if (!studentId || !classSubjectId || !examId) {
    return NextResponse.json(
      { error: 'Student ID, class subject ID, and exam ID are required' },
      { status: 400 }
    );
  }

  // Validate mark range
  if (marks !== undefined && marks !== null) {
    const classSubject = await db.classSubject.findUnique({
      where: { id: classSubjectId },
      include: { class: { select: { schoolType: true } } },
    });
    if (classSubject) {
      const maxMarks = classSubject.class.schoolType === 'PRIMARY' ? 50 : 100;
      if (marks < 0 || marks > maxMarks) {
        return NextResponse.json(
          { error: `Invalid mark. ${classSubject.class.schoolType === 'PRIMARY' ? 'Primary' : 'Secondary'} school marks must be between 0 and ${maxMarks}.` },
          { status: 400 }
        );
      }
    }
  }

  // Get class subject to determine school type for auto-grading
  let computedGrade = grade;
  let computedRemarks = remarks;

  if (marks !== undefined && marks !== null && !grade) {
    const classSubject = await db.classSubject.findUnique({
      where: { id: classSubjectId },
      include: { class: { select: { schoolType: true } } },
    });
    if (classSubject) {
      computedGrade = getGrade(marks, classSubject.class.schoolType);
      computedRemarks = getRemarks(computedGrade);
    }
  }

  // Upsert: create or update the mark
  const mark = await db.marksEntry.upsert({
    where: {
      studentId_classSubjectId_examId: {
        studentId,
        classSubjectId,
        examId,
      },
    },
    create: {
      studentId,
      classSubjectId,
      examId,
      marks: marks ?? null,
      grade: computedGrade || null,
      remarks: computedRemarks || null,
    },
    update: {
      marks: marks !== undefined ? marks : undefined,
      grade: computedGrade !== undefined ? computedGrade : undefined,
      remarks: computedRemarks !== undefined ? computedRemarks : undefined,
    },
  });

  return NextResponse.json({
    message: 'Mark saved successfully',
    mark,
  });
}

async function handleBulkSave(body: {
  marks: Array<{
    studentId: string;
    classSubjectId: string;
    examId: string;
    marks?: number | null;
  }>;
  classId: string;
}, actor: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>) {
  const { marks, classId } = body;

  if (!marks || !Array.isArray(marks) || marks.length === 0) {
    return NextResponse.json({ error: 'Marks array is required' }, { status: 400 });
  }

  if (!classId) {
    return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
  }

  // Get class for school type
  const classRecord = await db.class.findUnique({ where: { id: classId } });
  if (!classRecord) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }

  for (const markEntry of marks) {
    const classSubject = await db.classSubject.findUnique({ where: { id: markEntry.classSubjectId }, select: { classId: true } })
    const student = await db.student.findUnique({ where: { id: markEntry.studentId }, select: { classId: true } })
    if (classSubject?.classId !== classId || student?.classId !== classId) {
      return NextResponse.json({ error: 'Mark does not belong to the selected class' }, { status: 400 })
    }
    if (actor.role === 'TEACHER') {
      const teacher = await db.teacher.findUnique({ where: { userId: actor.id }, select: { id: true } })
      const classTeacher = teacher ? await db.classTeacherAssignment.findFirst({ where: { teacherId: teacher.id, classId, status: 'ACTIVE' }, select: { id: true } }) : null
      if (!classTeacher) {
        const assignment = teacher ? await db.teacherSubject.findFirst({ where: { teacherId: teacher.id, classId, subjectId: (await db.classSubject.findUnique({ where: { id: markEntry.classSubjectId }, select: { subjectId: true } }))?.subjectId } }) : null
        if (!assignment) return NextResponse.json({ error: 'Teacher is not authorized for one or more selected subjects' }, { status: 403 })
      }
    }
  }

  // Validate all marks before saving
  for (const markEntry of marks) {
    if (markEntry.marks != null && (markEntry.marks < 0 || markEntry.marks > (classRecord.schoolType === 'PRIMARY' ? 50 : 100))) {
      return NextResponse.json(
        { error: `Invalid mark ${markEntry.marks} for ${classRecord.schoolType} school. Must be between 0 and ${classRecord.schoolType === 'PRIMARY' ? 50 : 100}.` },
        { status: 400 }
      );
    }
  }

  // Process all marks in a transaction
  const results = await db.$transaction(
    marks.map(markEntry => {
      const grade = markEntry.marks != null ? getGrade(markEntry.marks, classRecord.schoolType) : null;
      const remarks = grade ? getRemarks(grade) : null;

      return db.marksEntry.upsert({
        where: {
          studentId_classSubjectId_examId: {
            studentId: markEntry.studentId,
            classSubjectId: markEntry.classSubjectId,
            examId: markEntry.examId,
          },
        },
        create: {
          studentId: markEntry.studentId,
          classSubjectId: markEntry.classSubjectId,
          examId: markEntry.examId,
          marks: markEntry.marks ?? null,
          grade,
          remarks,
        },
        update: {
          marks: markEntry.marks !== undefined ? markEntry.marks : undefined,
          grade: grade !== undefined ? grade : undefined,
          remarks: remarks !== undefined ? remarks : undefined,
        },
      });
    })
  );

  return NextResponse.json({
    message: `${results.length} marks saved successfully`,
    saved: results.length,
  });
}

async function handleComputeResults(body: {
  classId: string;
  examId: string;
}) {
  const { classId, examId } = body;

  if (!classId || !examId) {
    return NextResponse.json(
      { error: 'Class ID and Exam ID are required' },
      { status: 400 }
    );
  }

  // Get class info
  const classRecord = await db.class.findUnique({
    where: { id: classId },
    include: {
      subjects: { include: { subject: true } },
    },
  });

  if (!classRecord) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }

  const schoolType = classRecord.schoolType;
  const classSubjectIds = classRecord.subjects.map(cs => cs.id);

  // Minimum subjects for a student to be considered COMPLETE
  // Secondary: 7 subjects minimum; Primary: 1 subject minimum (primary students typically all take same subjects)
  const MIN_SUBJECTS_FOR_COMPLETE = schoolType === 'SECONDARY' ? 7 : 1;

  // Get all marks for this exam in this class
  const allMarks = await db.marksEntry.findMany({
    where: {
      examId,
      classSubjectId: { in: classSubjectIds },
    },
    include: {
      student: { select: { id: true, fullName: true } },
      classSubject: { include: { subject: { select: { id: true, name: true } } } },
    },
  });

  // Get all active students in the class
  const students = await db.student.findMany({
    where: { classId, status: 'ACTIVE' },
  });

  // Group marks by student - only count subjects where student has actual marks
  const studentMarksMap = new Map<string, Map<string, number>>();

  for (const mark of allMarks) {
    if (mark.marks === null) continue;
    if (!studentMarksMap.has(mark.studentId)) {
      studentMarksMap.set(mark.studentId, new Map());
    }
    const subjectMarks = studentMarksMap.get(mark.studentId)!;
    subjectMarks.set(mark.classSubject.subject.id, mark.marks);
  }

  // Compute results for each student
  const computedResults: Array<{
    studentId: string;
    totalMarks: number | null;
    averageMarks: number | null;
    grade: string | null;
    division?: string | null;
    points?: number | null;
    subjectCount: number;
    status: string; // COMPLETE or INCOMPLETE
  }> = [];

  for (const student of students) {
    const subjectMarks = studentMarksMap.get(student.id);
    const subjectCount = subjectMarks ? subjectMarks.size : 0;

    // Check if student meets minimum subject requirement
    if (!subjectMarks || subjectCount === 0) {
      // No marks at all — INCOMPLETE
      computedResults.push({
        studentId: student.id,
        totalMarks: null,
        averageMarks: null,
        grade: null,
        division: schoolType === 'SECONDARY' ? null : undefined,
        points: schoolType === 'SECONDARY' ? null : undefined,
        subjectCount: 0,
        status: 'INCOMPLETE',
      });
      continue;
    }

    const marksArray = Array.from(subjectMarks.values());
    const totalMarks = marksArray.reduce((sum, m) => sum + m, 0);

    if (subjectCount < MIN_SUBJECTS_FOR_COMPLETE) {
      // Below minimum subjects — INCOMPLETE, no average/rank calculated
      computedResults.push({
        studentId: student.id,
        totalMarks,
        averageMarks: null,
        grade: null,
        division: null,
        points: null,
        subjectCount,
        status: 'INCOMPLETE',
      });
      continue;
    }

    // COMPLETE: Student has enough subjects — calculate average, grade, division, points
    // Average = total marks / number of subjects the student actually took
    const averageMarks = totalMarks / subjectCount;
    const grade = getGrade(averageMarks, schoolType);

    let division: string | null = null;
    let points: number | null = null;

    if (schoolType === 'SECONDARY') {
      // Calculate NECTA points using best 7 subjects
      const subjectGrades = marksArray.map(m => getGrade(m, 'SECONDARY'));
      const subjectPoints = subjectGrades.map(g => getNectaPoints(g));
      subjectPoints.sort((a, b) => a - b); // ascending (best first)
      const bestSeven = subjectPoints.slice(0, 7);
      points = bestSeven.reduce((sum, p) => sum + p, 0);
      division = getDivision(points, bestSeven.length);
    }

    computedResults.push({
      studentId: student.id,
      totalMarks,
      averageMarks: Math.round(averageMarks * 100) / 100,
      grade,
      division,
      points,
      subjectCount,
      status: 'COMPLETE',
    });
  }

  // Rank ONLY COMPLETE students by averageMarks DESCENDING (higher average = better rank)
  // INCOMPLETE students will have rank = null
  const completeStudents = computedResults.filter(r => r.status === 'COMPLETE');
  const incompleteStudents = computedResults.filter(r => r.status === 'INCOMPLETE');

  // Sort complete students by average descending
  completeStudents.sort((a, b) => (b.averageMarks ?? 0) - (a.averageMarks ?? 0));

  // Assign ranks to COMPLETE students only (handle ties) using Dense Ranking
  // Dense Ranking: ties get same rank, next rank is not skipped
  let currentRank = 1;
  for (let i = 0; i < completeStudents.length; i++) {
    if (i > 0) {
      if (completeStudents[i].averageMarks !== completeStudents[i - 1].averageMarks) {
        currentRank = currentRank + 1;
      }
    }
    (completeStudents[i] as Record<string, unknown>)['rank'] = currentRank;
  }

  // INCOMPLETE students get null rank
  for (const result of incompleteStudents) {
    (result as Record<string, unknown>)['rank'] = null;
  }

  // Combine: complete students first (sorted by rank), then incomplete
  const allResults = [...completeStudents, ...incompleteStudents];

  // Save results to StudentResult table
  await db.$transaction(
    allResults.map(result =>
      db.studentResult.upsert({
        where: {
          studentId_examId: {
            studentId: result.studentId,
            examId,
          },
        },
        create: {
          studentId: result.studentId,
          examId,
          classId,
          totalMarks: result.totalMarks,
          averageMarks: result.averageMarks,
          grade: result.grade,
          division: result.division || null,
          points: result.points || null,
          rank: (result as Record<string, unknown>)['rank'] as number | null,
          status: result.status,
          subjectCount: result.subjectCount,
        },
        update: {
          totalMarks: result.totalMarks,
          averageMarks: result.averageMarks,
          grade: result.grade,
          division: result.division || null,
          points: result.points || null,
          rank: (result as Record<string, unknown>)['rank'] as number | null,
          status: result.status,
          subjectCount: result.subjectCount,
        },
      })
    )
  );

  // Return enriched results
  const enrichedResults = allResults.map(r => {
    const student = students.find(s => s.id === r.studentId);
    return {
      ...r,
      studentName: student?.fullName,
      admissionNo: student?.admissionNo,
      rank: (r as Record<string, unknown>)['rank'],
    };
  });

  const completeCount = completeStudents.length;
  const incompleteCount = incompleteStudents.length;

  return NextResponse.json({
    message: `Results computed: ${completeCount} complete, ${incompleteCount} incomplete (need ${MIN_SUBJECTS_FOR_COMPLETE}+ subjects)`,
    results: enrichedResults,
    totalStudents: students.length,
    completeCount,
    incompleteCount,
    minSubjectsRequired: MIN_SUBJECTS_FOR_COMPLETE,
    schoolType,
  });
}
