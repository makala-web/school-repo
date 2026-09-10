import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, rejectDemoMutation } from '@/lib/server-auth';

// Required for static export

// GET: Export all data as JSON backup, or get stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const actor = await getAuthenticatedUser(request);

    if (action === 'stats') {
      return await handleStats(searchParams, actor);
    }

    if (!actor) return NextResponse.json({ error: 'Authentication is required' }, { status: 401 });
    return await handleExport(searchParams, actor);
  } catch (error) {
    console.error('Error in backup GET:', error);
    return NextResponse.json({ error: 'Backup operation failed' }, { status: 500 });
  }
}

async function handleStats(searchParams: URLSearchParams, actor: Awaited<ReturnType<typeof getAuthenticatedUser>>) {
  const schoolType = searchParams.get('schoolType');
  const schoolId = searchParams.get('schoolId');
  if (!actor) return NextResponse.json({ error: 'Authentication is required' }, { status: 401 });
  const isPlatformOwner = actor.role === 'SUPER_ADMIN';
  const missingSchool = isPlatformOwner ? null : requireSchoolId(schoolId);
  if (missingSchool) return missingSchool;
  if (!isPlatformOwner && actor.schoolId !== schoolId) {
    return NextResponse.json({ error: 'Cross-school statistics access denied' }, { status: 403 });
  }

  console.log('[BACKUP API] Getting stats. schoolId:', schoolId, 'schoolType:', schoolType)

  // Build where clause for schoolType and schoolId filtering
  const schoolWhere: Record<string, unknown> = {};
  if (schoolType) schoolWhere.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';
  if (schoolId) schoolWhere.id = schoolId;

  // For classes, filter by schoolType and schoolId through the school relation
  const classWhere: Record<string, unknown> = {};
  if (schoolId || schoolType) {
    const schoolFilter: Record<string, unknown> = {};
    if (schoolId) schoolFilter.id = schoolId;
    if (schoolType) schoolFilter.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';
    classWhere.school = schoolFilter;
  }

  // For students, filter through class relation
  const studentWhere: Record<string, unknown> = {};
  if (schoolId || schoolType) {
    const schoolFilter: Record<string, unknown> = {};
    if (schoolId) schoolFilter.id = schoolId;
    if (schoolType) schoolFilter.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';
    studentWhere.class = { school: schoolFilter };
  }

  // For teachers, filter through school relation
  const teacherWhere: Record<string, unknown> = {};
  if (schoolId || schoolType) {
    const schoolFilter: Record<string, unknown> = {};
    if (schoolId) schoolFilter.id = schoolId;
    if (schoolType) schoolFilter.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';
    teacherWhere.school = schoolFilter;
  }

  // For subjects, filter through school relation
  const subjectWhere: Record<string, unknown> = {};
  if (schoolId || schoolType) {
    const schoolFilter: Record<string, unknown> = {};
    if (schoolId) schoolFilter.id = schoolId;
    if (schoolType) schoolFilter.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';
    subjectWhere.school = schoolFilter;
  }

  // For exams, filter through class relation
  const examWhere: Record<string, unknown> = {};
  if (schoolId || schoolType) {
    const schoolFilter: Record<string, unknown> = {};
    if (schoolId) schoolFilter.id = schoolId;
    if (schoolType) schoolFilter.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';
    examWhere.class = { school: schoolFilter };
  }

  // For marksEntries, filter through classSubject -> class -> school
  const marksWhere: Record<string, unknown> = {};
  if (schoolId || schoolType) {
    const schoolFilter: Record<string, unknown> = {};
    if (schoolId) schoolFilter.id = schoolId;
    if (schoolType) schoolFilter.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';
    marksWhere.classSubject = { class: { school: schoolFilter } };
  }

  // For studentResults, filter through class relation
  const resultsWhere: Record<string, unknown> = {};
  if (schoolId || schoolType) {
    const schoolFilter: Record<string, unknown> = {};
    if (schoolId) schoolFilter.id = schoolId;
    if (schoolType) schoolFilter.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';
    resultsWhere.class = { school: schoolFilter };
  }

  // For attendance, filter through student -> class -> school
  const attendanceWhere: Record<string, unknown> = {};
  if (schoolId || schoolType) {
    const schoolFilter: Record<string, unknown> = {};
    if (schoolId) schoolFilter.id = schoolId;
    if (schoolType) schoolFilter.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';
    attendanceWhere.student = { class: { school: schoolFilter } };
  }

  // For tabia, filter through student -> class -> school
  const tabiaWhere: Record<string, unknown> = {};
  if (schoolId || schoolType) {
    const schoolFilter: Record<string, unknown> = {};
    if (schoolId) schoolFilter.id = schoolId;
    if (schoolType) schoolFilter.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';
    tabiaWhere.student = { class: { school: schoolFilter } };
  }

  // For gradingConfigs, filter through school relation
  const gradingWhere: Record<string, unknown> = {};
  if (schoolId || schoolType) {
    const schoolFilter: Record<string, unknown> = {};
    if (schoolId) schoolFilter.id = schoolId;
    if (schoolType) schoolFilter.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';
    gradingWhere.school = schoolFilter;
  }

  const [
    schools,
    classes,
    students,
    teachers,
    subjects,
    exams,
    marksEntries,
    studentResults,
    users,
    attendance,
    tabia,
    gradingConfigs,
  ] = await Promise.all([
    db.school.count({ where: schoolWhere }),
    db.class.count({ where: classWhere }),
    db.student.count({ where: studentWhere }),
    db.teacher.count({ where: teacherWhere }),
    db.subject.count({ where: subjectWhere }),
    db.exam.count({ where: examWhere }),
    db.marksEntry.count({ where: marksWhere }),
    db.studentResult.count({ where: resultsWhere }),
    schoolId ? db.user.count({ where: { schoolId } }) : db.user.count(),
    db.attendance.count({ where: attendanceWhere }),
    db.tabia.count({ where: tabiaWhere }),
    db.gradingConfig.count({ where: gradingWhere }),
  ]);

  return NextResponse.json({
    stats: {
      schools,
      classes,
      students,
      teachers,
      subjects,
      exams,
      marksEntries,
      studentResults,
      users,
      attendance,
      tabia,
      gradingConfigs,
    },
  });
}

function requireSchoolId(schoolId: string | null) {
  if (!schoolId) {
    return NextResponse.json({ error: 'schoolId is required for isolated backup operations' }, { status: 400 });
  }
  return null;
}

async function handleExport(searchParams: URLSearchParams, actor: Awaited<ReturnType<typeof getAuthenticatedUser>>) {
  const schoolId = searchParams.get('schoolId');
  const schoolType = searchParams.get('schoolType');
  const missingSchool = requireSchoolId(schoolId);
  if (missingSchool) return missingSchool;
  if (!actor || (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId)) {
    return NextResponse.json({ error: 'Cross-school backup access denied' }, { status: 403 });
  }
  const scopedSchoolId = schoolId as string;

  const schoolFilter: Record<string, unknown> = { id: scopedSchoolId };
  if (schoolType) schoolFilter.schoolType = schoolType as 'PRIMARY' | 'SECONDARY';

  const classFilter = { schoolId: scopedSchoolId };
  const studentFilter = { schoolId: scopedSchoolId };
  const schoolRelationFilter = { school: schoolFilter };
  const classSchoolFilter = { class: { schoolId: scopedSchoolId } };
  const studentSchoolFilter = { student: { schoolId: scopedSchoolId } };

  // Export all data as JSON
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    schoolId: scopedSchoolId,
    schoolType,
    schools: await db.school.findMany({ where: schoolFilter }),
    // Never export password hashes or security answers to the browser.
    users: (await db.user.findMany({ where: { schoolId: scopedSchoolId } })).map(({ password: _password, securityAnswer: _securityAnswer, ...safeUser }) => safeUser),
    teachers: await db.teacher.findMany({ where: { schoolId: scopedSchoolId } }),
    classes: await db.class.findMany({ where: classFilter }),
    students: await db.student.findMany({ where: studentFilter }),
    subjects: await db.subject.findMany({ where: { schoolId: scopedSchoolId } }),
    classSubjects: await db.classSubject.findMany({ where: classSchoolFilter }),
    teacherSubjects: await db.teacherSubject.findMany({ where: classSchoolFilter }),
    exams: await db.exam.findMany({ where: { schoolId: scopedSchoolId } }),
    marksEntries: await db.marksEntry.findMany({ where: studentSchoolFilter }),
    attendance: await db.attendance.findMany({ where: studentSchoolFilter }),
    tabia: await db.tabia.findMany({ where: studentSchoolFilter }),
    studentResults: await db.studentResult.findMany({ where: classSchoolFilter }),
    gradingConfigs: await db.gradingConfig.findMany({ where: schoolRelationFilter }),
    backupLogs: await db.backupLog.findMany(),
    appSettings: await db.appSetting.findMany(),
  };

  // Log the backup
  await db.backupLog.create({
    data: {
      fileName: `backup-${new Date().toISOString().split('T')[0]}.json`,
      backupType: 'FULL',
      fileSize: `${JSON.stringify(data).length} bytes`,
    },
  });

  return NextResponse.json({ backup: data });
}

// POST: Import data from JSON backup
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request);
    if (!actor) return NextResponse.json({ error: 'Authentication is required' }, { status: 401 });
    const body = await request.json();
    const { backup } = body;
    const schoolId = body.schoolId as string | undefined;
    const missingSchool = requireSchoolId(schoolId || null);
    if (missingSchool) return missingSchool;
    if (actor.role !== 'SCHOOL_ADMIN' || actor.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Only the school administrator can restore this school backup' }, { status: 403 });
    }

    if (!backup || typeof backup !== 'object') {
      return NextResponse.json({ error: 'Backup data is required' }, { status: 400 });
    }

    const backupTables = [
      'schools',
      'users',
      'teachers',
      'subjects',
      'classes',
      'classSubjects',
      'students',
      'teacherSubjects',
      'exams',
      'marksEntries',
      'attendance',
      'tabia',
      'studentResults',
      'gradingConfigs',
      'backupLogs',
      'appSettings',
    ];

    if (typeof backup.version !== 'string') {
      return NextResponse.json({ error: 'Invalid backup file: missing version' }, { status: 400 });
    }

    if (Array.isArray(backup.schools) && backup.schools.some((school: { id?: string }) => school.id !== schoolId)) {
      return NextResponse.json({ error: 'Backup belongs to a different school' }, { status: 400 });
    }

    if (!backupTables.some((key) => Array.isArray(backup[key]))) {
      return NextResponse.json({ error: 'Invalid backup file: no supported tables found' }, { status: 400 });
    }

    for (const key of backupTables) {
      if (backup[key] !== undefined && !Array.isArray(backup[key])) {
        return NextResponse.json({ error: `Invalid backup file: ${key} must be an array` }, { status: 400 });
      }
    }

    const importResults: Record<string, number> = {};

    // Import in order of dependencies
    // 1. Schools (no dependencies)
    if (backup.schools && Array.isArray(backup.schools)) {
      let count = 0;
      for (const school of backup.schools) {
        try {
          await db.school.upsert({
            where: { id: school.id },
            create: school,
            update: school,
          });
          count++;
        } catch (e) {
          console.error('Error importing school:', e);
        }
      }
      importResults.schools = count;
    }

    // 2. Users (depends on school)
    if (backup.users && Array.isArray(backup.users)) {
      let count = 0;
      for (const user of backup.users) {
        try {
          await db.user.upsert({
            where: { id: user.id },
            create: user,
            update: user,
          });
          count++;
        } catch (e) {
          console.error('Error importing user:', e);
        }
      }
      importResults.users = count;
    }

    // 3. Teachers (depends on school, user)
    if (backup.teachers && Array.isArray(backup.teachers)) {
      let count = 0;
      for (const teacher of backup.teachers) {
        try {
          await db.teacher.upsert({
            where: { id: teacher.id },
            create: teacher,
            update: teacher,
          });
          count++;
        } catch (e) {
          console.error('Error importing teacher:', e);
        }
      }
      importResults.teachers = count;
    }

    // 4. Subjects (depends on school)
    if (backup.subjects && Array.isArray(backup.subjects)) {
      let count = 0;
      for (const subject of backup.subjects) {
        try {
          await db.subject.upsert({
            where: { id: subject.id },
            create: subject,
            update: subject,
          });
          count++;
        } catch (e) {
          console.error('Error importing subject:', e);
        }
      }
      importResults.subjects = count;
    }

    // 5. Classes (depends on school, teacher)
    if (backup.classes && Array.isArray(backup.classes)) {
      let count = 0;
      for (const cls of backup.classes) {
        try {
          await db.class.upsert({
            where: { id: cls.id },
            create: cls,
            update: cls,
          });
          count++;
        } catch (e) {
          console.error('Error importing class:', e);
        }
      }
      importResults.classes = count;
    }

    // 6. ClassSubjects (depends on class, subject)
    if (backup.classSubjects && Array.isArray(backup.classSubjects)) {
      let count = 0;
      for (const cs of backup.classSubjects) {
        try {
          await db.classSubject.upsert({
            where: { id: cs.id },
            create: cs,
            update: cs,
          });
          count++;
        } catch (e) {
          console.error('Error importing classSubject:', e);
        }
      }
      importResults.classSubjects = count;
    }

    // 7. Students (depends on class, school)
    if (backup.students && Array.isArray(backup.students)) {
      let count = 0;
      for (const student of backup.students) {
        try {
          await db.student.upsert({
            where: { id: student.id },
            create: student,
            update: student,
          });
          count++;
        } catch (e) {
          console.error('Error importing student:', e);
        }
      }
      importResults.students = count;
    }

    // 8. TeacherSubjects (depends on teacher, subject, class)
    if (backup.teacherSubjects && Array.isArray(backup.teacherSubjects)) {
      let count = 0;
      for (const ts of backup.teacherSubjects) {
        try {
          await db.teacherSubject.upsert({
            where: { id: ts.id },
            create: ts,
            update: ts,
          });
          count++;
        } catch (e) {
          console.error('Error importing teacherSubject:', e);
        }
      }
      importResults.teacherSubjects = count;
    }

    // 9. Exams (depends on class, school)
    if (backup.exams && Array.isArray(backup.exams)) {
      let count = 0;
      for (const exam of backup.exams) {
        try {
          await db.exam.upsert({
            where: { id: exam.id },
            create: exam,
            update: exam,
          });
          count++;
        } catch (e) {
          console.error('Error importing exam:', e);
        }
      }
      importResults.exams = count;
    }

    // 10. MarksEntries (depends on student, classSubject, exam)
    if (backup.marksEntries && Array.isArray(backup.marksEntries)) {
      let count = 0;
      for (const mark of backup.marksEntries) {
        try {
          await db.marksEntry.upsert({
            where: { id: mark.id },
            create: mark,
            update: mark,
          });
          count++;
        } catch (e) {
          console.error('Error importing marksEntry:', e);
        }
      }
      importResults.marksEntries = count;
    }

    // 11. Attendance (depends on student, class)
    if (backup.attendance && Array.isArray(backup.attendance)) {
      let count = 0;
      for (const att of backup.attendance) {
        try {
          await db.attendance.upsert({
            where: { id: att.id },
            create: att,
            update: att,
          });
          count++;
        } catch (e) {
          console.error('Error importing attendance:', e);
        }
      }
      importResults.attendance = count;
    }

    // 12. Tabia (depends on student, class)
    if (backup.tabia && Array.isArray(backup.tabia)) {
      let count = 0;
      for (const tab of backup.tabia) {
        try {
          await db.tabia.upsert({
            where: { id: tab.id },
            create: tab,
            update: tab,
          });
          count++;
        } catch (e) {
          console.error('Error importing tabia:', e);
        }
      }
      importResults.tabia = count;
    }

    // 13. StudentResults (depends on student, exam, class)
    if (backup.studentResults && Array.isArray(backup.studentResults)) {
      let count = 0;
      for (const result of backup.studentResults) {
        try {
          await db.studentResult.upsert({
            where: { id: result.id },
            create: result,
            update: result,
          });
          count++;
        } catch (e) {
          console.error('Error importing studentResult:', e);
        }
      }
      importResults.studentResults = count;
    }

    // 14. GradingConfigs (depends on school)
    if (backup.gradingConfigs && Array.isArray(backup.gradingConfigs)) {
      let count = 0;
      for (const gc of backup.gradingConfigs) {
        try {
          await db.gradingConfig.upsert({
            where: { id: gc.id },
            create: gc,
            update: gc,
          });
          count++;
        } catch (e) {
          console.error('Error importing gradingConfig:', e);
        }
      }
      importResults.gradingConfigs = count;
    }

    // 15. BackupLogs (no dependencies)
    if (backup.backupLogs && Array.isArray(backup.backupLogs)) {
      let count = 0;
      for (const log of backup.backupLogs) {
        try {
          await db.backupLog.upsert({
            where: { id: log.id },
            create: log,
            update: log,
          });
          count++;
        } catch (e) {
          console.error('Error importing backupLog:', e);
        }
      }
      importResults.backupLogs = count;
    }

    // 16. AppSettings (no dependencies)
    if (backup.appSettings && Array.isArray(backup.appSettings)) {
      let count = 0;
      for (const setting of backup.appSettings) {
        try {
          await db.appSetting.upsert({
            where: { id: setting.id },
            create: setting,
            update: setting,
          });
          count++;
        } catch (e) {
          console.error('Error importing appSetting:', e);
        }
      }
      importResults.appSettings = count;
    }

    return NextResponse.json({
      message: 'Backup imported successfully',
      importResults,
    });
  } catch (error) {
    console.error('Error importing backup:', error);
    return NextResponse.json({ error: 'Failed to import backup' }, { status: 500 });
  }
}
