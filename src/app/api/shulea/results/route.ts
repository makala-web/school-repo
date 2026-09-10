import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ResultsRepository } from '@/repositories/ResultsRepository';
import { getAuthenticatedUser, rejectDemoMutation } from '@/lib/server-auth';
import { fillDefaultReportComments } from '@/modules/settings/default-comments';

async function authorizeResultsRequest(request: NextRequest) {
  const actor = await getAuthenticatedUser(request)
  if (!actor) return { actor: null, response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  if (actor.role === 'SUPER_ADMIN') return { actor, response: null }

  const params = request.nextUrl.searchParams
  const examId = params.get('examId')
  const classId = params.get('classId')
  const studentId = params.get('studentId')

  let targetSchoolId: string | null = null
  let targetClassId: string | null = classId

  if (examId) {
    const exam = await db.exam.findUnique({ where: { id: examId }, select: { schoolId: true, classId: true } })
    if (!exam) return { actor: null, response: NextResponse.json({ error: 'Exam not found' }, { status: 404 }) }
    targetSchoolId = exam.schoolId
    targetClassId = targetClassId || exam.classId
  } else if (classId) {
    const classRecord = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } })
    if (!classRecord) return { actor: null, response: NextResponse.json({ error: 'Class not found' }, { status: 404 }) }
    targetSchoolId = classRecord.schoolId
  } else if (studentId) {
    const student = await db.student.findUnique({ where: { id: studentId }, select: { schoolId: true, classId: true } })
    if (!student) return { actor: null, response: NextResponse.json({ error: 'Student not found' }, { status: 404 }) }
    targetSchoolId = student.schoolId
    targetClassId = student.classId
  } else {
    return { actor: null, response: NextResponse.json({ error: 'A school-scoped exam, class, or student is required' }, { status: 400 }) }
  }

  if (actor.schoolId !== targetSchoolId) {
    return { actor: null, response: NextResponse.json({ error: 'Cross-school results access denied' }, { status: 403 }) }
  }

  if (actor.role === 'TEACHER' && targetClassId) {
    const teacher = await db.teacher.findUnique({ where: { userId: actor.id }, select: { id: true } })
    if (!teacher) return { actor: null, response: NextResponse.json({ error: 'Teacher profile not found' }, { status: 403 }) }
    const [classAssignment, subjectAssignment] = await Promise.all([
      db.classTeacherAssignment.findFirst({ where: { teacherId: teacher.id, classId: targetClassId, status: 'ACTIVE' }, select: { id: true } }),
      db.teacherSubject.findFirst({ where: { teacherId: teacher.id, classId: targetClassId }, select: { id: true } }),
    ])
    if (!classAssignment && !subjectAssignment) {
      return { actor: null, response: NextResponse.json({ error: 'Teacher is not authorized for this class' }, { status: 403 }) }
    }
  }

  return { actor, response: null }
}

// Required for static export

// GET: Multiple actions based on query params
export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeResultsRequest(request)
    if (authorization.response) return authorization.response
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'summary':
        return await handleSummary(searchParams);
      case 'top-students':
        return await handleTopStudents(searchParams);
      case 'bottom-students':
        return await handleBottomStudents(searchParams);
      case 'subject-analysis':
        return await handleSubjectAnalysis(searchParams);
      case 'report-card':
        return await handleReportCard(searchParams);
      case 'overall-results':
        return await handleOverallResults(searchParams);
      default:
        return await handleGetResults(searchParams);
    }
  } catch (error) {
    console.error('Error fetching results:', error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}

// POST: Update report dates
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const body = await request.json();
    const { action } = body;

    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'SCHOOL_ADMIN' && actor.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Results access denied' }, { status: 403 })
    }

    const exam = body.examId
      ? await db.exam.findUnique({ where: { id: body.examId }, select: { schoolId: true, classId: true } })
      : null
    if (body.examId && !exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
    const targetSchoolId = exam?.schoolId || (body.schoolId as string | undefined)
    const targetClassId = exam?.classId || (body.classId as string | undefined)
    if (actor.role !== 'SUPER_ADMIN' && (!targetSchoolId || actor.schoolId !== targetSchoolId)) {
      return NextResponse.json({ error: 'Cross-school results access denied' }, { status: 403 })
    }
    if (actor.role === 'TEACHER' && targetClassId) {
      const teacher = await db.teacher.findUnique({ where: { userId: actor.id }, select: { id: true } })
      const [classAssignment, subjectAssignment] = teacher ? await Promise.all([
        db.classTeacherAssignment.findFirst({ where: { teacherId: teacher.id, classId: targetClassId, status: 'ACTIVE' }, select: { id: true } }),
        db.teacherSubject.findFirst({ where: { teacherId: teacher.id, classId: targetClassId }, select: { id: true } }),
      ]) : [null, null]
      if (!classAssignment && !subjectAssignment) {
        return NextResponse.json({ error: 'Teacher is not authorized for this class' }, { status: 403 })
      }
    }

    if (action === 'update-dates') {
      return await handleUpdateDates(body);
    }

    // Support creating a result via POST with create payload
    if (!action || action === 'create') {
      try {
        const created = await ResultsRepository.create(body)
        return NextResponse.json({ message: 'Result created', result: created })
      } catch (err) {
        console.error('Error creating result:', err)
        return NextResponse.json({ error: (err as Error).message }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating results:', error);
    return NextResponse.json({ error: 'Failed to update results' }, { status: 500 });
  }
}

async function handleUpdateDates(body: {
  studentId?: string;
  examId: string;
  classId?: string;
  closingDate?: string;
  openingDate?: string;
}) {
  const { studentId, examId, classId, closingDate, openingDate } = body;

  if (!examId || (!studentId && !classId)) {
    return NextResponse.json(
      { error: 'Exam ID and either Student ID or Class ID are required' },
      { status: 400 }
    );
  }

  if (classId && !studentId) {
    const updated = await db.studentResult.updateMany({
      where: { examId, classId },
      data: {
        closingDate: closingDate || null,
        openingDate: openingDate || null,
      },
    });

    return NextResponse.json({
      message: 'Dates updated successfully',
      updated: updated.count,
    });
  }

  const existing = await db.studentResult.findUnique({
    where: { studentId_examId: { studentId: studentId!, examId } },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 });
  }

  const result = await db.studentResult.update({
    where: { studentId_examId: { studentId: studentId!, examId } },
    data: {
      closingDate: closingDate || null,
      openingDate: openingDate || null,
    },
  });

  return NextResponse.json({
    message: 'Dates updated successfully',
    result,
  });
}

// Default: Get student results (optional filter by examId, classId)
async function handleGetResults(searchParams: URLSearchParams) {
  const examId = searchParams.get('examId');
  const classId = searchParams.get('classId');
  const studentId = searchParams.get('studentId');

  const where: Record<string, unknown> = {};
  if (examId) where.examId = examId;
  if (classId) where.classId = classId;
  if (studentId) where.studentId = studentId;

  const results = await db.studentResult.findMany({
    where,
    include: {
      student: {
        select: { id: true, fullName: true, gender: true, admissionNo: true },
      },
      exam: {
        select: { id: true, name: true, examType: true, term: true, academicYear: true },
      },
      class: {
        select: { id: true, name: true, fullName: true, schoolType: true },
      },
    },
    orderBy: [
      { averageMarks: 'desc' },
    ],
  });

  return NextResponse.json({ results });
}

// Get class summary (grade distribution, division summary)
async function handleSummary(searchParams: URLSearchParams) {
  const examId = searchParams.get('examId');
  const classId = searchParams.get('classId');

  if (!examId || !classId) {
    return NextResponse.json(
      { error: 'Exam ID and Class ID are required for summary' },
      { status: 400 }
    );
  }

  const results = await db.studentResult.findMany({
    where: { examId, classId },
    include: {
      student: { select: { id: true, fullName: true, gender: true } },
    },
  });

  // Grade distribution — only for COMPLETE students
  const gradeDistribution: Record<string, number> = {};
  const divisionDistribution: Record<string, number> = {};
  let totalAverage = 0;
  let completeCount = 0;
  let incompleteCount = 0;
  let passedCount = 0;
  const totalRegistered = results.length;

  for (const result of results) {
    if (result.status === 'INCOMPLETE') {
      incompleteCount++;
      continue;
    }
    
    completeCount++;
    // Grade distribution (COMPLETE students only)
    const grade = result.grade || 'N/A';
    gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;

    // Division distribution (secondary, COMPLETE students only)
    if (result.division) {
      divisionDistribution[result.division] = (divisionDistribution[result.division] || 0) + 1;
    }

    // Averages (COMPLETE students only)
    if (result.averageMarks) {
      totalAverage += result.averageMarks;
    }

    // Pass count (grade C and above, COMPLETE students only)
    if (['A', 'B', 'C'].includes(grade)) {
      passedCount++;
    }
  }

  const classAverage = completeCount > 0 ? Math.round((totalAverage / completeCount) * 100) / 100 : 0;
  const passRate = completeCount > 0 ? Math.round((passedCount / completeCount) * 100) : 0;

  // Gender breakdown
  const maleResults = results.filter(r => r.status === 'COMPLETE' && r.student?.gender === 'M');
  const femaleResults = results.filter(r => r.status === 'COMPLETE' && r.student?.gender === 'F');

  // Highest/lowest scores from COMPLETE students only
  const completeResults = results.filter(r => r.status === 'COMPLETE');

  return NextResponse.json({
    summary: {
      totalStudents: completeCount,
      totalRegistered,
      completeCount,
      incompleteCount,
      classAverage,
      passRate,
      gradeDistribution,
      divisionDistribution,
      genderBreakdown: {
        male: maleResults.length,
        female: femaleResults.length,
      },
      highestScore: completeResults.length > 0 ? Math.max(...completeResults.map(r => r.averageMarks || 0)) : 0,
      lowestScore: completeResults.length > 0 ? Math.min(...completeResults.map(r => r.averageMarks || 0)) : 0,
    },
  });
}

// Get top N students
async function handleTopStudents(searchParams: URLSearchParams) {
  const examId = searchParams.get('examId');
  const classId = searchParams.get('classId');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!examId) {
    return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
  }

  const where: Record<string, unknown> = { examId, averageMarks: { not: null } };
  if (classId) where.classId = classId;

  const topStudents = await db.studentResult.findMany({
    where,
    include: {
      student: { select: { id: true, fullName: true, gender: true, admissionNo: true } },
      class: { select: { id: true, name: true, fullName: true, schoolType: true } },
      exam: { select: { name: true, term: true, academicYear: true } },
    },
    orderBy: [
      { averageMarks: 'desc' },
    ],
    take: limit,
  });

  return NextResponse.json({ topStudents: topStudents.filter(result => result.student) });
}

// Get bottom N students
async function handleBottomStudents(searchParams: URLSearchParams) {
  const examId = searchParams.get('examId');
  const classId = searchParams.get('classId');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!examId) {
    return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
  }

  const where: Record<string, unknown> = { examId, averageMarks: { not: null } };
  if (classId) where.classId = classId;

  const bottomStudents = await db.studentResult.findMany({
    where,
    include: {
      student: { select: { id: true, fullName: true, gender: true, admissionNo: true } },
      class: { select: { id: true, name: true, fullName: true, schoolType: true } },
      exam: { select: { name: true, term: true, academicYear: true } },
    },
    orderBy: [
      { averageMarks: 'asc' },
    ],
    take: limit,
  });

  return NextResponse.json({ bottomStudents: bottomStudents.filter(result => result.student) });
}

// Get subject performance analysis
async function handleSubjectAnalysis(searchParams: URLSearchParams) {
  const examId = searchParams.get('examId');
  const classId = searchParams.get('classId');

  if (!examId || !classId) {
    return NextResponse.json(
      { error: 'Exam ID and Class ID are required for subject analysis' },
      { status: 400 }
    );
  }

  // Get all class subjects
  const classSubjects = await db.classSubject.findMany({
    where: { classId },
    include: { subject: true },
  });

  const analysis: Array<{
    subjectId: string
    subjectName: string
    shortName: string | null
    totalStudents: number
    average: number
    highest: number
    lowest: number
    passRate: number
    gradeDistribution: Record<string, number>
  }> = [];

  for (const cs of classSubjects) {
    const marks = await db.marksEntry.findMany({
      where: {
        examId,
        classSubjectId: cs.id,
        marks: { not: null },
      },
    });

    if (marks.length === 0) continue;

    const marksValues = marks.map(m => m.marks!).filter((m): m is number => m !== null);
    const total = marksValues.reduce((sum, m) => sum + m, 0);
    const average = total / marksValues.length;
    const highest = Math.max(...marksValues);
    const lowest = Math.min(...marksValues);

    // Grade distribution for this subject
    const gradeDist: Record<string, number> = {};
    for (const mark of marks) {
      const grade = mark.grade || 'N/A';
      gradeDist[grade] = (gradeDist[grade] || 0) + 1;
    }

    // Pass rate (grade C and above)
    const passGrades = ['A', 'B', 'C'];
    const passCount = marks.filter(m => m.grade && passGrades.includes(m.grade)).length;
    const passRate = marks.length > 0 ? Math.round((passCount / marks.length) * 100) : 0;

    analysis.push({
      subjectId: cs.subject.id,
      subjectName: cs.subject.name,
      shortName: cs.subject.shortName,
      totalStudents: marks.length,
      average: Math.round(average * 100) / 100,
      highest,
      lowest,
      passRate,
      gradeDistribution: gradeDist,
    });
  }

  // Sort by average descending
  analysis.sort((a, b) => b.average - a.average);

  return NextResponse.json({ analysis });
}

// Get overall results with subjects as columns (wide table format)
async function handleOverallResults(searchParams: URLSearchParams) {
  const examId = searchParams.get('examId');
  const classId = searchParams.get('classId');

  if (!examId || !classId) {
    return NextResponse.json(
      { error: 'Exam ID and Class ID are required for overall results' },
      { status: 400 }
    );
  }

  // Get class info with subjects
  const classRecord = await db.class.findUnique({
    where: { id: classId },
    include: {
      subjects: { include: { subject: true } },
    },
  });

  if (!classRecord) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }

  // Get all subjects for the class
  const subjects = classRecord.subjects.map(cs => ({
    id: cs.subject.id,
    name: cs.subject.name,
    shortName: cs.subject.shortName,
  }));

  // Get all active students in the class
  const students = await db.student.findMany({
    where: { classId, status: 'ACTIVE' },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, gender: true, admissionNo: true },
  });

  // Get all marks for this exam in this class
  const classSubjectIds = classRecord.subjects.map(cs => cs.id);
  const allMarks = await db.marksEntry.findMany({
    where: {
      examId,
      classSubjectId: { in: classSubjectIds },
    },
    include: {
      classSubject: { include: { subject: { select: { id: true } } } },
    },
  });

  // Build a map: studentId -> subjectId -> { marks, grade }
  const marksMap = new Map<string, Map<string, { marks: number | null; grade: string | null }>>();
  for (const mark of allMarks) {
    if (!marksMap.has(mark.studentId)) {
      marksMap.set(mark.studentId, new Map());
    }
    marksMap.get(mark.studentId)!.set(mark.classSubject.subject.id, {
      marks: mark.marks,
      grade: mark.grade,
    });
  }

  // Get all computed results for this exam+class
  const results = await db.studentResult.findMany({
    where: { examId, classId },
    orderBy: { averageMarks: 'desc' },
  });

  // Build a map: studentId -> result
  const resultMap = new Map<string, (typeof results)[0]>();
  for (const result of results) {
    resultMap.set(result.studentId, result);
  }

  // Build the response
  const studentRows = students.map(student => {
    const studentMarks = marksMap.get(student.id) || new Map<string, { marks: number | null; grade: string | null }>();
    const subjectMarks: Record<string, { marks: number | null; grade: string | null }> = {};
    for (const subject of subjects) {
      const sm = studentMarks.get(subject.id);
      subjectMarks[subject.id] = sm || { marks: null, grade: null };
    }

    const result = resultMap.get(student.id);

    return {
      studentInfo: {
        id: student.id,
        fullName: student.fullName,
        gender: student.gender,
        admissionNo: student.admissionNo,
      },
      subjectMarks,
      result: result ? {
        average: result.averageMarks,
        grade: result.grade,
        points: result.points,
        division: result.division,
        rank: result.rank,
        status: result.status,
        subjectCount: result.subjectCount,
      } : null,
    };
  });

  // Sort: COMPLETE students first (by average descending), INCOMPLETE at the end
  studentRows.sort((a, b) => {
    // Both have results - sort by status first, then average
    if (a.result && b.result) {
      // COMPLETE before INCOMPLETE
      if (a.result.status === 'COMPLETE' && b.result.status !== 'COMPLETE') return -1;
      if (a.result.status !== 'COMPLETE' && b.result.status === 'COMPLETE') return 1;
      // Same status - sort by average
      return (b.result.average ?? 0) - (a.result.average ?? 0);
    }
    if (!a.result && !b.result) return 0;
    if (!a.result) return 1;
    if (!b.result) return -1;
    return 0;
  });

  const completeTotal = studentRows.filter(row => row.result?.status === 'COMPLETE').length;

  return NextResponse.json({
    students: studentRows,
    subjects,
    totalStudents: completeTotal,
    totalRegistered: students.length,
  });
}

// Get full report card data for a single student
async function handleReportCard(searchParams: URLSearchParams) {
  const studentId = searchParams.get('studentId');
  const examId = searchParams.get('examId');

  if (!studentId || !examId) {
    return NextResponse.json(
      { error: 'Student ID and Exam ID are required for report card' },
      { status: 400 }
    );
  }

  // Get student info
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      class: {
        include: {
          school: true,
          classTeacher: { select: { name: true, shortName: true, sign: true } },
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // Get exam info
  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  }

  // Get all marks for this student in this exam
  const marks = await db.marksEntry.findMany({
    where: {
      studentId,
      examId,
      classSubject: { classId: student.classId },
    },
    include: {
      classSubject: {
        include: {
          subject: { select: { id: true, name: true, shortName: true } },
        },
      },
    },
    orderBy: { classSubject: { subject: { name: 'asc' } } },
  });

  // Get computed result
  const result = await db.studentResult.findUnique({
    where: { studentId_examId: { studentId, examId } },
  });

  // Get tabia (character) record
  const tabia = await db.tabia.findUnique({
    where: {
      studentId_classId_examId: {
        studentId,
        classId: student.classId,
        examId,
      },
    },
  });

  // Get school leadership and report templates. Class teacher is derived from
  // the assignment register for this class and academic year; the legacy
  // Class.classTeacherId remains only as a compatibility fallback.
  const school = student.class.school;
  const reportSchool = fillDefaultReportComments(school);
  const classTeacherAssignment = await db.classTeacherAssignment.findFirst({
    where: {
      schoolId: school.id,
      classId: student.classId,
      academicYear: exam.academicYear,
      status: 'ACTIVE',
    },
    orderBy: { startDate: 'desc' },
    include: { teacher: { select: { name: true, shortName: true, sign: true } } },
  });
  const assignedClassTeacher = classTeacherAssignment?.teacher || student.class.classTeacher;

  // Build subject marks with positions
  const subjectMarks = marks.map(m => ({
    subjectId: m.classSubject.subject.id,
    subjectName: m.classSubject.subject.name,
    shortName: m.classSubject.subject.shortName,
    marks: m.marks,
    grade: m.grade,
    remarks: m.remarks,
  }));

  // Get teacher assignments for subjects
  const teacherAssignments = await db.teacherSubject.findMany({
    where: { classId: student.classId },
    include: {
      teacher: { select: { name: true, shortName: true } },
      subject: { select: { id: true, name: true } },
    },
  });

  const teacherMap = new Map<string, string>();
  for (const ta of teacherAssignments) {
    teacherMap.set(ta.subject.id, ta.teacher.name);
  }

  // Add teacher name to subject marks
  const enrichedSubjectMarks = subjectMarks.map(sm => ({
    ...sm,
    teacherName: teacherMap.get(sm.subjectId) || '',
  }));

  const candidateCount = await db.studentResult.count({
    where: {
      examId,
      classId: student.classId,
      status: 'COMPLETE',
    },
  });

  return NextResponse.json({
    reportCard: {
      student: {
        id: student.id,
        fullName: student.fullName,
        gender: student.gender,
        admissionNo: student.admissionNo,
        dob: student.dob,
      },
      class: {
        id: student.class.id,
        name: student.class.name,
        fullName: student.class.fullName,
        schoolType: student.class.schoolType,
        academicYear: student.class.academicYear,
        term: student.class.term,
      },
      school: {
        name: school.name,
        schoolType: school.schoolType,
        registrationNo: school.registrationNo,
        council: school.council,
        region: school.region,
        district: school.district,
        ward: school.ward,
        phone: school.phone,
        email: school.email,
        logo: school.logo,
        logo2: school.logo2,
        headTeacherName: school.headTeacherName,
        headTeacherSign: school.headTeacherSign,
        headTeacherComments: reportSchool.headTeacherComments,
        classTeacherName: reportSchool.classTeacherName,
        classTeacherShortName: reportSchool.classTeacherShortName,
        classTeacherComments: reportSchool.classTeacherComments,
        ctGradeA_en: reportSchool.ctGradeA_en,
        ctGradeB_en: reportSchool.ctGradeB_en,
        ctGradeC_en: reportSchool.ctGradeC_en,
        ctGradeD_en: reportSchool.ctGradeD_en,
        ctGradeE_en: reportSchool.ctGradeE_en,
        ctGradeA_sw: reportSchool.ctGradeA_sw,
        ctGradeB_sw: reportSchool.ctGradeB_sw,
        ctGradeC_sw: reportSchool.ctGradeC_sw,
        ctGradeD_sw: reportSchool.ctGradeD_sw,
        ctGradeE_sw: reportSchool.ctGradeE_sw,
        htGradeA_en: reportSchool.htGradeA_en,
        htGradeB_en: reportSchool.htGradeB_en,
        htGradeC_en: reportSchool.htGradeC_en,
        htGradeD_en: reportSchool.htGradeD_en,
        htGradeE_en: reportSchool.htGradeE_en,
        htGradeA_sw: reportSchool.htGradeA_sw,
        htGradeB_sw: reportSchool.htGradeB_sw,
        htGradeC_sw: reportSchool.htGradeC_sw,
        htGradeD_sw: reportSchool.htGradeD_sw,
        htGradeE_sw: reportSchool.htGradeE_sw,
      },
      exam: {
        id: exam.id,
        name: exam.name,
        examType: exam.examType,
        term: exam.term,
        academicYear: exam.academicYear,
        examDate: exam.examDate,
      },
      marks: enrichedSubjectMarks,
      result: result ? {
        totalMarks: result.totalMarks,
        averageMarks: result.averageMarks,
        grade: result.grade,
        division: result.division,
        points: result.points,
        rank: result.rank,
        status: result.status,
        subjectCount: result.subjectCount,
        classTeacherComment: result.classTeacherComment,
        headTeacherComment: result.headTeacherComment,
        closingDate: result.closingDate,
        openingDate: result.openingDate,
      } : null,
      totalStudents: candidateCount,
      tabia: tabia ? {
        discipline: tabia.discipline,
        hygiene: tabia.hygiene,
        hardWorking: tabia.hardWorking,
        cooperation: tabia.cooperation,
        honesty: tabia.honesty,
        leadership: tabia.leadership,
        sports: tabia.sports,
      } : null,
      classTeacher: assignedClassTeacher ? {
        name: assignedClassTeacher.name,
        shortName: assignedClassTeacher.shortName,
        sign: assignedClassTeacher.sign,
      } : null,
    },
  });
}
