import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSchoolLicenseStatus, getDeviceInfo, checkDeviceAuthorization } from '@/lib/access-control';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/password';
import { createAuthSession, getAuthenticatedUser } from '@/lib/server-auth';
import { getMasterSubjects } from '@/lib/subject-catalogue';
import { DEFAULT_REPORT_COMMENTS } from '@/modules/settings/default-comments';

function isDatabaseConnectivityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('can\'t reach database server') ||
    message.includes('prismaclientinitializationerror') ||
    message.includes('database connection') ||
    message.includes('connection refused') ||
    message.includes('timed out')
}

// Tanzania Curriculum Default Subjects
function getDefaultSubjects(schoolType: 'PRIMARY' | 'SECONDARY'): Array<{ name: string; shortName: string; schoolType: 'PRIMARY' | 'SECONDARY' }> {
  return getMasterSubjects(schoolType).map(({ name, shortName, schoolType: type }) => ({
    name,
    shortName,
    schoolType: type,
  }))
}

async function ensureDemoData(demoUserId: string, schoolType: 'PRIMARY' | 'SECONDARY') {
  const user = await db.user.findUnique({ where: { id: demoUserId }, include: { school: true, teacher: true } })
  if (!user?.school) return
  const schoolId = user.school.id
  const demoName = schoolType === 'SECONDARY' ? 'Namirah Islamic Secondary School' : 'Muzdalifah Islamic Primary School'
  await db.school.update({
    where: { id: schoolId },
    data: {
      name: demoName,
      region: 'Tanga',
      district: 'Korogwe Mjini',
      email: 'abuunuhail@gmail.com',
      phone: '0623424892',
      // Demo must exercise the same grade-based report-card comments as a
      // provisioned school, rather than relying on client-only templates.
      ...DEFAULT_REPORT_COMMENTS,
    },
  })
  // Keep the demo intentionally small: one class, 15 students and two exams.
  // Real schools can create and manage any number of classes separately.
  const classNames = schoolType === 'SECONDARY' ? ['Form 1'] : ['STD 1']
  const subjectLimit = schoolType === 'SECONDARY' ? 9 : 5
  const maxDemoMark = schoolType === 'PRIMARY' ? 50 : 100
  const getDemoGrade = (mark: number) => {
    if (schoolType === 'PRIMARY') {
      if (mark >= 41) return 'A'
      if (mark >= 31) return 'B'
      if (mark >= 21) return 'C'
      if (mark >= 11) return 'D'
      return 'E'
    }
    if (mark >= 75) return 'A'
    if (mark >= 65) return 'B'
    if (mark >= 45) return 'C'
    if (mark >= 30) return 'D'
    return 'F'
  }
  const getDemoRemark = (grade: string) => ({ A: 'Excellent', B: 'Very Good', C: 'Good', D: 'Satisfactory', E: 'Poor', F: 'Fail' }[grade] || '')
  const defaultSubjects = getDefaultSubjects(schoolType)

  // The demo is seeded once and then reused. Without this health check every
  // Continue click deleted and recreated hundreds of records.
  const expectedMarks = classNames.length * 15 * subjectLimit * 2
  const [classCount, studentCount, subjectCount, marksCount, invalidMarksCount, demoMarks, resultValues, attendanceCount, classTeacherAssignments] = await Promise.all([
    db.class.count({ where: { schoolId } }),
    db.student.count({ where: { schoolId } }),
    db.subject.count({ where: { schoolId, schoolType } }),
    db.marksEntry.count({ where: { student: { schoolId } } }),
    db.marksEntry.count({ where: { student: { schoolId }, marks: { gt: maxDemoMark } } }),
    db.marksEntry.findMany({ where: { student: { schoolId } }, select: { marks: true, grade: true }, take: expectedMarks }),
    db.studentResult.findMany({ where: { student: { schoolId } }, select: { id: true, averageMarks: true, rank: true, grade: true, classTeacherComment: true, headTeacherComment: true }, take: 100 }),
    db.attendance.count({ where: { student: { schoolId } } }),
    db.classTeacherAssignment.findMany({ where: { schoolId, academicYear: '2026', status: 'ACTIVE' }, select: { classId: true, teacherId: true } }),
  ])
  const expectedClassIds = await db.class.findMany({ where: { schoolId, name: { in: classNames } }, select: { id: true } })
  const classTeacherMap = new Map(classTeacherAssignments.map(assignment => [assignment.classId, assignment.teacherId]))
  const hasDistinctClassTeachers = expectedClassIds.length === classNames.length &&
    expectedClassIds.every(classRecord => classTeacherMap.has(classRecord.id)) &&
    new Set(expectedClassIds.map(classRecord => classTeacherMap.get(classRecord.id))).size === classNames.length
  if (
    classCount === classNames.length &&
    studentCount === classNames.length * 15 &&
    subjectCount === subjectLimit &&
    marksCount >= expectedMarks &&
    invalidMarksCount === 0 &&
    demoMarks.length >= expectedMarks &&
    demoMarks.every(mark => mark.marks !== null && mark.grade === getDemoGrade(mark.marks)) &&
    resultValues.length >= classNames.length * 15 * 2 &&
    resultValues.every(result => result.averageMarks !== null && result.grade === getDemoGrade(result.averageMarks)) &&
    new Set(resultValues.map(result => result.averageMarks)).size > 1 &&
    resultValues.every(result => result.rank != null) &&
    resultValues.every(result => Boolean(result.classTeacherComment && result.headTeacherComment)) &&
    attendanceCount >= classNames.length * 15 * 3 &&
    hasDistinctClassTeachers
  ) {
    return
  }

  for (const subject of defaultSubjects.slice(0, subjectLimit)) {
    const existing = await db.subject.findFirst({ where: { schoolId, name: subject.name } })
    if (!existing) await db.subject.create({ data: { ...subject, schoolId } })
  }

  // Demo is a controlled sample tenant. Remove old generated records so every
  // preview starts with exactly two classes and a predictable subject set.
  const existingClasses = await db.class.findMany({ where: { schoolId } })
  for (const extraClass of existingClasses.filter(item => !classNames.includes(item.name))) {
    const extraStudents = await db.student.findMany({ where: { classId: extraClass.id }, select: { id: true } })
    const extraExams = await db.exam.findMany({ where: { classId: extraClass.id }, select: { id: true } })
    const extraSubjects = await db.classSubject.findMany({ where: { classId: extraClass.id }, select: { id: true } })
    await db.marksEntry.deleteMany({ where: { OR: [{ studentId: { in: extraStudents.map(item => item.id) } }, { examId: { in: extraExams.map(item => item.id) } }, { classSubjectId: { in: extraSubjects.map(item => item.id) } }] } })
    await db.studentResult.deleteMany({ where: { OR: [{ studentId: { in: extraStudents.map(item => item.id) } }, { examId: { in: extraExams.map(item => item.id) } }] } })
    await db.attendance.deleteMany({ where: { studentId: { in: extraStudents.map(item => item.id) } } })
    await db.tabia.deleteMany({ where: { studentId: { in: extraStudents.map(item => item.id) } } })
    await db.exam.deleteMany({ where: { id: { in: extraExams.map(item => item.id) } } })
    await db.classSubject.deleteMany({ where: { id: { in: extraSubjects.map(item => item.id) } } })
    await db.teacherSubject.deleteMany({ where: { classId: extraClass.id } })
    await db.classTeacherAssignment.deleteMany({ where: { classId: extraClass.id } })
    await db.student.deleteMany({ where: { id: { in: extraStudents.map(item => item.id) } } })
    await db.class.delete({ where: { id: extraClass.id } })
  }

  const subjects = await db.subject.findMany({ where: { schoolId }, orderBy: { createdAt: 'asc' } })
  const demoSubjects = subjects.slice(0, subjectLimit)
  const allClasses = await db.class.findMany({ where: { schoolId }, select: { id: true } })
  const allClassSubjects = await db.classSubject.findMany({ where: { classId: { in: allClasses.map(item => item.id) } }, select: { id: true } })
  await db.teacherSubject.deleteMany({ where: { classId: { in: allClasses.map(item => item.id) } } })
  await db.marksEntry.deleteMany({ where: { classSubjectId: { in: allClassSubjects.map(item => item.id) } } })
  await db.classSubject.deleteMany({ where: { id: { in: allClassSubjects.map(item => item.id) } } })
  await db.subject.deleteMany({ where: { schoolId, id: { notIn: demoSubjects.map(item => item.id) } } })
  const names = ['Asha Juma', 'Baraka Mushi', 'Chiku Salum', 'Dotto Kimaro', 'Ester Macha', 'Faraja Omari', 'Hassan Said', 'Imani Paulo', 'Jabir Ali', 'Khadija Suleiman', 'Lucas Mollel', 'Mariam Hamisi', 'Neema Joseph', 'Omari Bakari', 'Rehema Abdallah']
  const teachers = await db.teacher.findMany({ where: { schoolId }, orderBy: { createdAt: 'asc' } })
  let demoTeacher = user.teacher || teachers[0]
  if (!demoTeacher) {
    demoTeacher = await db.teacher.create({ data: { name: 'Demo Teacher', schoolId, userId: demoUserId } })
  } else if (!demoTeacher.userId) {
    demoTeacher = await db.teacher.update({ where: { id: demoTeacher.id }, data: { userId: demoUserId } })
  }

  // Give every demo class its own class teacher. This exercises the same
  // class-scoped assignment path used by real report cards.
  const classTeachers = [demoTeacher]
  for (let classIndex = 1; classIndex < classNames.length; classIndex++) {
    const teacherName = `Demo Class Teacher ${classNames[classIndex]}`
    const classTeacher = await db.teacher.findFirst({ where: { schoolId, name: teacherName } }) ||
      await db.teacher.create({ data: { name: teacherName, shortName: classNames[classIndex], schoolId } })
    classTeachers.push(classTeacher)
  }

  const headTeacher = await db.teacher.upsert({
    where: { id: `demo-head-${schoolType.toLowerCase()}` },
    update: { name: 'Mwalimu Juma Hamisi', schoolId },
    create: { id: `demo-head-${schoolType.toLowerCase()}`, name: 'Mwalimu Juma Hamisi', shortName: 'J.Hamisi', schoolId },
  })
  await db.schoolLeadership.upsert({ where: { schoolId }, update: { headTeacherId: headTeacher.id, status: 'ACTIVE', startDate: '2026-01-01' }, create: { schoolId, headTeacherId: headTeacher.id, status: 'ACTIVE', startDate: '2026-01-01' } })
  await db.school.update({ where: { id: schoolId }, data: { headTeacherName: headTeacher.name } })

  for (let classIndex = 0; classIndex < classNames.length; classIndex++) {
    const classTeacher = classTeachers[classIndex]
    let classRecord = await db.class.findFirst({ where: { schoolId, name: classNames[classIndex] } })
    if (!classRecord) {
      classRecord = await db.class.create({ data: { name: classNames[classIndex], fullName: classNames[classIndex], schoolType, schoolId, academicYear: '2026', term: 'FIRST TERM' } })
    }
    const currentStudents = await db.student.findMany({ where: { schoolId, classId: classRecord.id }, orderBy: { createdAt: 'asc' } })
    for (let i = currentStudents.length; i < 15; i++) {
      await db.student.create({ data: { admissionNo: `DEMO-${classIndex + 1}-${String(i + 1).padStart(3, '0')}`, fullName: names[i], gender: i % 2 ? 'M' : 'F', status: 'ACTIVE', classId: classRecord.id, schoolId } })
    }
    for (const subject of demoSubjects) {
      await db.classSubject.upsert({ where: { classId_subjectId: { classId: classRecord.id, subjectId: subject.id } }, update: {}, create: { classId: classRecord.id, subjectId: subject.id } })
    }
    const oldExams = await db.exam.findMany({ where: { classId: classRecord.id }, select: { id: true } })
    await db.marksEntry.deleteMany({ where: { examId: { in: oldExams.map(item => item.id) } } })
    await db.studentResult.deleteMany({ where: { examId: { in: oldExams.map(item => item.id) } } })
    await db.tabia.deleteMany({ where: { examId: { in: oldExams.map(item => item.id) } } })
    await db.exam.deleteMany({ where: { id: { in: oldExams.map(item => item.id) } } })
    const exams = [
      await db.exam.create({ data: { id: `demo-${schoolType.toLowerCase()}-${classIndex}-test`, name: 'Demo Class Test', examType: 'MONTHLY', classId: classRecord.id, schoolId, academicYear: '2026', term: 'FIRST TERM', examDate: '2026-05-15' } }),
      await db.exam.create({ data: { id: `demo-${schoolType.toLowerCase()}-${classIndex}-exam`, name: 'Demo Terminal Examination', examType: 'TERMINAL', classId: classRecord.id, schoolId, academicYear: '2026', term: 'FIRST TERM', examDate: '2026-06-15' } }),
    ]
    const classSubjects = await db.classSubject.findMany({ where: { classId: classRecord.id, subjectId: { in: demoSubjects.map(subject => subject.id) } } })
    const students = await db.student.findMany({ where: { schoolId, classId: classRecord.id, status: 'ACTIVE' } })
    for (const subject of demoSubjects) await db.teacherSubject.create({ data: { teacherId: classTeacher.id, subjectId: subject.id, classId: classRecord.id } })
    for (const [studentIndex, student] of students.entries()) {
      for (const exam of exams) {
        let totalMarks = 0
        for (let subjectIndex = 0; subjectIndex < classSubjects.length; subjectIndex++) {
          // Include the student index so the preview produces meaningful
          // averages and positions instead of identical results for everyone.
          const examBonus = exam.name.includes('Terminal') ? 5 : 0
          const rawMarks = schoolType === 'PRIMARY'
            ? 25 + studentIndex + subjectIndex + examBonus
            : 45 + (studentIndex * 3) + (subjectIndex * 2) + examBonus
          const marks = Math.min(maxDemoMark, rawMarks)
          totalMarks += marks
          const grade = getDemoGrade(marks)
          await db.marksEntry.create({ data: { studentId: student.id, classSubjectId: classSubjects[subjectIndex].id, examId: exam.id, marks, grade, remarks: getDemoRemark(grade) } })
        }
        const averageMarks = totalMarks / Math.max(classSubjects.length, 1)
        const grade = getDemoGrade(averageMarks)
        const classTeacherComment = DEFAULT_REPORT_COMMENTS[`ctGrade${grade === 'F' ? 'E' : grade}_sw` as keyof typeof DEFAULT_REPORT_COMMENTS]
        const headTeacherComment = DEFAULT_REPORT_COMMENTS[`htGrade${grade === 'F' ? 'E' : grade}_sw` as keyof typeof DEFAULT_REPORT_COMMENTS]
        await db.studentResult.create({ data: { studentId: student.id, examId: exam.id, classId: classRecord.id, totalMarks, averageMarks, grade, division: schoolType === 'SECONDARY' ? (averageMarks >= 75 ? 'I' : averageMarks >= 60 ? 'II' : averageMarks >= 45 ? 'III' : 'IV') : null, points: schoolType === 'SECONDARY' ? (averageMarks >= 75 ? 7 : averageMarks >= 60 ? 18 : averageMarks >= 45 ? 24 : 30) : null, status: 'COMPLETE', subjectCount: classSubjects.length, classTeacherComment, headTeacherComment } })
        for (const date of ['2026-06-13', '2026-06-14', '2026-06-15']) await db.attendance.upsert({ where: { studentId_classId_date: { studentId: student.id, classId: classRecord.id, date } }, update: { status: date === '2026-06-14' && student.id.length % 5 === 0 ? 'ABSENT' : 'PRESENT' }, create: { studentId: student.id, classId: classRecord.id, date, status: date === '2026-06-14' && student.id.length % 5 === 0 ? 'ABSENT' : 'PRESENT' } })
        await db.tabia.upsert({ where: { studentId_classId_examId: { studentId: student.id, classId: classRecord.id, examId: exam.id } }, update: { discipline: 'A', hygiene: 'A', hardWorking: 'B', cooperation: 'A', honesty: 'A', leadership: 'B', sports: 'A' }, create: { studentId: student.id, classId: classRecord.id, examId: exam.id, discipline: 'A', hygiene: 'A', hardWorking: 'B', cooperation: 'A', honesty: 'A', leadership: 'B', sports: 'A' } })
      }
    }
    // Persist deterministic class positions for the demo report cards.
    for (const exam of exams) {
      const rankedResults = await db.studentResult.findMany({
        where: { classId: classRecord.id, examId: exam.id },
        orderBy: [{ averageMarks: 'desc' }, { totalMarks: 'desc' }, { studentId: 'asc' }],
        select: { id: true },
      })
      for (const [rankIndex, result] of rankedResults.entries()) {
        await db.studentResult.update({ where: { id: result.id }, data: { rank: rankIndex + 1 } })
      }
    }
    await db.classTeacherAssignment.upsert({ where: { schoolId_classId_academicYear_status: { schoolId, classId: classRecord.id, academicYear: '2026', status: 'ACTIVE' } }, update: { teacherId: classTeacher.id }, create: { schoolId, classId: classRecord.id, teacherId: classTeacher.id, academicYear: '2026', startDate: '2026-01-01', status: 'ACTIVE' } })
    await db.class.update({ where: { id: classRecord.id }, data: { classTeacherId: classTeacher.id } })
  }
}

// GET: Check if any user exists
export async function GET() {
  try {
    const userCount = await db.user.count();
    return NextResponse.json({ hasUsers: userCount > 0, userCount });
  } catch (error) {
    console.error('Error checking users:', error);
    if (isDatabaseConnectivityError(error)) {
      return NextResponse.json({ error: 'Production database is temporarily unavailable', code: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to check users' }, { status: 500 });
  }
}

// POST: Multiple actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'login':
        return await handleLogin(body);
      case 'demo-login':
        return await handleDemoLogin(body);
      case 'register-with-invitation':
        return await handleRegisterWithInvitation(body);
      case 'change-password':
        return await handleChangePassword(body, request);
      case 'join-school':
        return await handleJoinSchool(body, request);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Auth error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    if (isDatabaseConnectivityError(error)) {
      return NextResponse.json({ error: 'Production database is temporarily unavailable', code: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleDemoLogin(body?: { schoolType?: 'PRIMARY' | 'SECONDARY' }) {
  const requestedSchoolType = body?.schoolType === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY';
  const demoEmail = requestedSchoolType === 'SECONDARY' ? 'demo-secondary@shulea.app' : 'demo@shulea.app';
  const demoPassword = 'Demo@12345';

  let demoUser = await db.user.findUnique({
    where: { email: demoEmail },
    include: { school: true },
  });

  if (!demoUser) {
    const today = new Date();
    const expiry = new Date(today);
    expiry.setDate(expiry.getDate() + 30);

    const demoSchool = await db.school.create({
      data: {
        name: requestedSchoolType === 'SECONDARY' ? 'Namirah Islamic Secondary School' : 'Muzdalifah Islamic Primary School',
        schoolType: requestedSchoolType,
        isDemo: true,
        licenseType: 'DEMO',
        licenseStatus: 'ACTIVE',
        activationCode: requestedSchoolType === 'SECONDARY' ? 'DEMO-SECONDARY-30-DAYS' : 'DEMO-30-DAYS',
        startDate: today.toISOString().slice(0, 10),
        expiryDate: expiry.toISOString().slice(0, 10),
        maxTeachers: requestedSchoolType === 'SECONDARY' ? 8 : 5,
        maxDevices: 5,
        maxStudents: requestedSchoolType === 'SECONDARY' ? 300 : 200,
        phone: '0623424892',
        council: requestedSchoolType === 'SECONDARY' ? 'Dar es Salaam' : 'Dar es Salaam',
        region: 'Dar es Salaam',
        district: 'Ilala',
        ward: 'Kinondoni',
        headTeacherName: requestedSchoolType === 'SECONDARY' ? 'Mwalimu Juma Hamisi' : 'Mwalimu Juma Hamisi',
        registrationNo: requestedSchoolType === 'SECONDARY' ? 'DEMO-SEC-2026-001' : 'DEMO-2026-001',
      } as any,
    });

    demoUser = await db.user.create({
      data: {
        email: demoEmail,
        username: requestedSchoolType === 'SECONDARY' ? 'demo-secondary' : 'demo-user',
        password: await hashPassword(demoPassword),
        passwordHash: await hashPassword(demoPassword),
        fullName: requestedSchoolType === 'SECONDARY' ? 'Shulea Secondary Demo User' : 'Shulea Demo User',
        role: 'TEACHER',
        schoolId: demoSchool.id,
        schoolType: requestedSchoolType,
        active: true,
        isDemoUser: true,
        securityQuestion: 'Demo access',
        securityAnswer: await hashPassword('demo'),
      },
      include: { school: true },
    });
  }

  if (demoUser.role !== 'TEACHER' || !demoUser.isDemoUser) {
    demoUser = await db.user.update({ where: { id: demoUser.id }, data: { role: 'TEACHER', isDemoUser: true }, include: { school: true } })
  }
  await ensureDemoData(demoUser.id, requestedSchoolType)

  const { password: _, securityAnswer: __, ...userData } = demoUser;
  const response = NextResponse.json({
    message: `${requestedSchoolType === 'SECONDARY' ? 'Secondary' : 'Primary'} demo access granted`,
    user: userData,
  });
  await createAuthSession(demoUser.id, response);
  return response;
}

async function handleLogin(body: {
  email: string;
  password: string;
  deviceInfo?: { deviceId: string; platform: string; userAgent: string; deviceName: string };
}) {
  const email = body.email?.trim().toLowerCase()
  const { password, deviceInfo } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required', code: 'MISSING_CREDENTIALS' }, { status: 400 });
  }

  try {
    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
      include: { school: true, teacher: true },
    });

    if (!user) {
      return NextResponse.json({ 
        error: 'No account was found for this email. Use Request Access or accept a valid school invitation.', 
        code: 'USER_NOT_FOUND' 
      }, { status: 401 });
    }

    const storedPasswordHash = user.passwordHash || user.password;
    if (!await verifyPassword(password, storedPasswordHash)) {
      return NextResponse.json({ 
        error: 'Incorrect password. Try again or reset your password.', 
        code: 'WRONG_PASSWORD' 
      }, { status: 401 });
    }

    if (!user.passwordHash) {
      await db.user.update({ where: { id: user.id }, data: { passwordHash: storedPasswordHash } });
    }

    if (!user.active) {
      return NextResponse.json({ error: 'Account is deactivated', code: 'ACCOUNT_DEACTIVATED' }, { status: 403 });
    }

    const school = user.school as (typeof user.school & {
      licenseStatus?: string | null;
      expiryDate?: string | null;
      maxDevices?: number | null;
    }) | null;
    const licenseStatus: { isActive: boolean; reason: string; message: string } = school
      ? getSchoolLicenseStatus({
          status: school.licenseStatus || 'ACTIVE',
          expiryDate: school.expiryDate || undefined,
        })
      : { isActive: true, reason: 'ACTIVE', message: 'License is active and authorized for this school.' };

    if (school && !licenseStatus.isActive) {
      return NextResponse.json({
        error: licenseStatus.message || 'This school is not authorized to access the system.',
        code: 'SCHOOL_LICENSE_INACTIVE',
      }, { status: 403 });
    }

    // Device authorization check (skip for demo users and super admins)
    if (school && !user.isDemoUser && user.role !== 'SUPER_ADMIN' && deviceInfo) {
      const deviceId = deviceInfo.deviceId;
      
      // Check if device exists for this user
      const existingDevice = await db.device.findFirst({
        where: { deviceId, userId: user.id }
      });

      if (existingDevice) {
        // Check device status
        const deviceStatus = checkDeviceAuthorization(
          {
            deviceId: existingDevice.deviceId,
            schoolId: existingDevice.schoolId,
            userId: existingDevice.userId,
            status: existingDevice.status,
            activatedAt: existingDevice.activatedAt.toISOString(),
            lastSeenAt: existingDevice.lastSeenAt.toISOString(),
          },
          school.maxDevices || 20,
          await db.device.count({ where: { schoolId: school.id, status: 'ACTIVE' } })
        );

        if (!deviceStatus.isAuthorized) {
          return NextResponse.json({
            error: deviceStatus.message,
            code: 'DEVICE_NOT_AUTHORIZED',
          }, { status: 403 });
        }

        // Update last seen time
        await db.device.update({
          where: { id: existingDevice.id },
          data: { lastSeenAt: new Date().toISOString() }
        });
      } else {
        // Check device limit before authorizing new device
        const currentDeviceCount = await db.device.count({
          where: { schoolId: school.id, status: 'ACTIVE' }
        });

        if (currentDeviceCount >= (school.maxDevices || 20)) {
          return NextResponse.json({
            error: `Device limit reached (${school.maxDevices || 20}). Please contact your school administrator to authorize this device.`,
            code: 'DEVICE_LIMIT_REACHED',
          }, { status: 403 });
        }

        // Authorize new device
        await db.device.create({
          data: {
            deviceId,
            deviceName: deviceInfo.deviceName || 'Unknown Device',
            platform: deviceInfo.platform || 'Unknown',
            userAgent: deviceInfo.userAgent || '',
            schoolId: school.id,
            userId: user.id,
            status: 'ACTIVE',
            activatedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
          }
        });

        // Update user device ID
        await db.user.update({
          where: { id: user.id },
          data: { deviceId }
        });
      }
    }

    // Update last school access time
    await db.user.update({
      where: { id: user.id },
      data: { lastSchoolAccessAt: new Date().toISOString() }
    });

    const { password: _, securityAnswer: __, ...userData } = user;
    const response = NextResponse.json({
      message: 'Login successful',
      user: userData,
    });
    await createAuthSession(user.id, response);
    return response;
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    if (isDatabaseConnectivityError(error)) {
      return NextResponse.json({ error: 'Production database is temporarily unavailable', code: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Login failed due to server error', code: 'SERVER_ERROR' }, { status: 500 });
  }
}

async function handleRegisterWithInvitation(body: {
  inviteCode: string;
  email: string;
  password: string;
  fullName: string;
  schoolId: string;
  schoolType: string;
  role: string;
}) {
  const { inviteCode, email, password, fullName } = body;

  if (!inviteCode || !email || !password || !fullName) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  // Validate strong password
  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: passwordCheck.errors.join(', ') }, { status: 400 });
  }

  // Check if invitation exists and is valid
  const invitation = await db.invitation.findUnique({
    where: { inviteCode },
    include: { school: true }
  });

  if (!invitation) {
    return NextResponse.json({ error: 'Invalid invitation code' }, { status: 404 });
  }

  // Check if invitation is still valid
  const now = new Date();
  const expiresAt = new Date(invitation.expiresAt);
  if (invitation.status !== 'PENDING' || expiresAt < now) {
    return NextResponse.json({ error: 'Invitation is expired or no longer valid' }, { status: 400 });
  }

  // Check if email matches invitation
  if (email.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json({ error: 'Email does not match invitation' }, { status: 400 });
  }

  const invitedRole = invitation.role === 'SCHOOL_ADMIN' ? 'SCHOOL_ADMIN' : 'TEACHER';

  // Check if user already exists
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  // Generate username from email
  const username = email.split('@')[0] + Math.random().toString(36).substring(2, 8);

  // Create user
  const user = await db.user.create({
    data: {
      email,
      username,
      password: await hashPassword(password),
      passwordHash: await hashPassword(password),
      fullName,
      role: invitedRole,
      schoolId: invitation.schoolId,
      schoolType: invitation.school.schoolType,
      active: true,
      securityQuestion: 'Set during invitation acceptance',
      securityAnswer: await hashPassword('invitation-' + inviteCode),
    },
    include: { school: true },
  });

  // Create teacher record if role is TEACHER
  if (invitedRole === 'TEACHER') {
    const teacher = await db.teacher.create({
      data: {
        name: fullName,
        schoolId: invitation.schoolId,
        userId: user.id,
      }
    });

    let assignedClassIds: string[] = []
    let assignedSubjectIds: string[] = []
    try {
      const parsedClasses = JSON.parse(invitation.assignedClasses || '[]')
      const parsedSubjects = JSON.parse(invitation.assignedSubjects || '[]')
      assignedClassIds = Array.isArray(parsedClasses) ? parsedClasses.filter(item => typeof item === 'string') : []
      assignedSubjectIds = Array.isArray(parsedSubjects) ? parsedSubjects.filter(item => typeof item === 'string') : []
    } catch {
      assignedClassIds = []
      assignedSubjectIds = []
    }

    const [assignedClasses, assignedSubjects] = await Promise.all([
      db.class.findMany({ where: { id: { in: assignedClassIds }, schoolId: invitation.schoolId }, select: { id: true } }),
      db.subject.findMany({ where: { id: { in: assignedSubjectIds }, schoolId: invitation.schoolId }, select: { id: true } }),
    ])
    await Promise.all(
      assignedClasses.flatMap(classRecord => assignedSubjects.map(subject =>
        db.teacherSubject.upsert({
          where: { teacherId_subjectId_classId: { teacherId: teacher.id, subjectId: subject.id, classId: classRecord.id } },
          update: {},
          create: { teacherId: teacher.id, subjectId: subject.id, classId: classRecord.id },
        })
      ))
    )

    // A class selected by the school administrator is also registered as a
    // class-teacher responsibility when the invitation is accepted. Never
    // replace an existing active assignment for the same class/year.
    await Promise.all(assignedClasses.map(async (classRecord) => {
      const classInfo = await db.class.findUnique({
        where: { id: classRecord.id },
        select: { academicYear: true },
      })
      const academicYear = classInfo?.academicYear || String(new Date().getFullYear())
      const existingAssignment = await db.classTeacherAssignment.findFirst({
        where: {
          schoolId: invitation.schoolId,
          classId: classRecord.id,
          academicYear,
          status: 'ACTIVE',
        },
        select: { id: true },
      })
      if (!existingAssignment) {
        await db.classTeacherAssignment.create({
          data: {
            schoolId: invitation.schoolId,
            classId: classRecord.id,
            teacherId: teacher.id,
            academicYear,
            startDate: now.toISOString().slice(0, 10),
            status: 'ACTIVE',
          },
        })
      }
    }))
  }

  // Update invitation status
  await db.invitation.update({
    where: { id: invitation.id },
    data: {
      status: 'ACCEPTED',
      receiverId: user.id,
      acceptedAt: now.toISOString(),
    }
  });

  const { password: _, securityAnswer: __, ...userData } = user;
  return NextResponse.json({
    message: 'Account created successfully via invitation',
    user: userData,
  }, { status: 201 });
}

async function handleChangePassword(body: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}, request: NextRequest) {
  const { userId, currentPassword, newPassword } = body;

  if (!userId || !currentPassword || !newPassword) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  const actor = await getAuthenticatedUser(request);
  if (!actor || actor.id !== userId) {
    return NextResponse.json({ error: 'Authenticated user does not match the requested account' }, { status: 403 });
  }

  // Validate strong password
  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: passwordCheck.errors.join(', ') }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!await verifyPassword(currentPassword, user.passwordHash || user.password)) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  await db.user.update({
    where: { id: userId },
    data: { password: await hashPassword(newPassword), passwordHash: await hashPassword(newPassword) },
  });

  return NextResponse.json({ message: 'Password changed successfully' });
}

async function handleJoinSchool(body: {
  inviteCode: string;
  userId: string;
}, request: NextRequest) {
  const { inviteCode, userId } = body;

  if (!inviteCode || !userId) {
    return NextResponse.json({ error: 'Invite code and user ID are required' }, { status: 400 });
  }

  const actor = await getAuthenticatedUser(request);
  if (!actor || actor.id !== userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 403 });
  }

  try {
    // Find the invitation
    const invitation = await db.invitation.findUnique({
      where: { inviteCode },
      include: { school: true }
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid invitation code' }, { status: 404 });
    }

    // Check if invitation is still valid
    const now = new Date();
    const expiresAt = new Date(invitation.expiresAt);
    if (invitation.status !== 'PENDING' || expiresAt < now) {
      return NextResponse.json({ error: 'Invitation is expired or no longer valid' }, { status: 400 });
    }

    // Get the user
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if email matches
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json({ error: 'This invitation is for a different email address' }, { status: 400 });
    }

    // Update user to join the school
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        schoolId: invitation.schoolId,
        schoolType: invitation.school.schoolType,
        role: invitation.role,
      }
    });

    // Create teacher record
    const teacher = await db.teacher.upsert({
      where: { userId: user.id },
      update: { name: user.fullName, schoolId: invitation.schoolId },
      create: {
        name: user.fullName,
        schoolId: invitation.schoolId,
        userId: user.id,
      }
    });

    // Preserve the administrator's class-teacher selections when an existing
    // user accepts an invitation through the join-school flow as well.
    let invitedClassIds: string[] = []
    try {
      const parsed = JSON.parse(invitation.assignedClasses || '[]')
      invitedClassIds = Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []
    } catch {
      invitedClassIds = []
    }
    const invitedClasses = await db.class.findMany({
      where: { id: { in: invitedClassIds }, schoolId: invitation.schoolId },
      select: { id: true, academicYear: true },
    })
    for (const classRecord of invitedClasses) {
      const academicYear = classRecord.academicYear || String(new Date().getFullYear())
      const existingAssignment = await db.classTeacherAssignment.findFirst({
        where: { schoolId: invitation.schoolId, classId: classRecord.id, academicYear, status: 'ACTIVE' },
        select: { id: true },
      })
      if (!existingAssignment) {
        await db.classTeacherAssignment.create({
          data: {
            schoolId: invitation.schoolId,
            classId: classRecord.id,
            teacherId: teacher.id,
            academicYear,
            startDate: now.toISOString().slice(0, 10),
            status: 'ACTIVE',
          },
        })
      }
    }

    // Update invitation status
    await db.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        receiverId: userId,
        acceptedAt: now.toISOString(),
      }
    });

    const { password: _, securityAnswer: __, ...userData } = updatedUser;
    return NextResponse.json({
      message: 'Successfully joined the school',
      user: userData,
      teacher,
    });
  } catch (error) {
    console.error('[AUTH] Join school error:', error);
    return NextResponse.json({ error: 'Failed to join school', code: 'JOIN_FAILED' }, { status: 500 });
  }
}
