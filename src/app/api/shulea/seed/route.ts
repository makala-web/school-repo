import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { getAuthenticatedUser, rejectDemoMutation } from '@/lib/server-auth';
import { getMasterSubjects } from '@/lib/subject-catalogue';

// Required for static export

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// POST: Seed the database with default data
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor || actor.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'School administrator access required' }, { status: 403 })
    }
    const body = await request.json().catch(() => ({}));
    const schoolId = body.schoolId;
    const schoolType = body.schoolType || 'PRIMARY';
    const includePP12 = body.includePP12 !== undefined ? body.includePP12 : true; // default true for backward compat
    const userId = body.userId || null;

    if (schoolId && actor.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Cross-school seed access denied' }, { status: 403 })
    }
    if (userId && userId !== actor.id) {
      return NextResponse.json({ error: 'Seed user does not match the active session' }, { status: 403 })
    }

    const results: Record<string, string | number | boolean> = {};

    // Get or create the school
    let school;
    if (schoolId) {
      school = await db.school.findUnique({ where: { id: schoolId } });
    }
    if (!school) {
      // Use the first school
      const schools = await db.school.findMany();
      school = schools[0];
    }

    if (school) {
      if (school.id !== actor.schoolId) return NextResponse.json({ error: 'School seed access denied' }, { status: 403 })
      const effectiveSchoolType = school.schoolType || schoolType;

      // === SEED SUBJECTS ===
      const subjectsToCreate = getMasterSubjects(effectiveSchoolType);

      const existingSubjects = await db.subject.count({
        where: { schoolId: school.id, schoolType: effectiveSchoolType },
      });

      if (existingSubjects === 0) {
        const subjectData = subjectsToCreate.map((s) => ({
          name: s.name,
          shortName: s.shortName,
          schoolType: effectiveSchoolType,
          schoolId: school!.id,
        }));
        await db.subject.createMany({ data: subjectData });
        results.subjects = `Created ${subjectData.length} subjects for ${effectiveSchoolType}`;
      } else {
        results.subjects = `${existingSubjects} subjects already exist`;
      }

      // === SEED GRADING (only for relevant school type) ===
      const existingGrading = await db.gradingConfig.count({
        where: { schoolId: school.id, schoolType: effectiveSchoolType },
      });

      if (existingGrading === 0) {
        const gradingData =
          effectiveSchoolType === 'PRIMARY'
            ? [
                { schoolType: 'PRIMARY', grade: 'A', minMark: 41, maxMark: 50, remarks: 'Excellent', schoolId: school.id },
                { schoolType: 'PRIMARY', grade: 'B', minMark: 31, maxMark: 40, remarks: 'Very Good', schoolId: school.id },
                { schoolType: 'PRIMARY', grade: 'C', minMark: 21, maxMark: 30, remarks: 'Good', schoolId: school.id },
                { schoolType: 'PRIMARY', grade: 'D', minMark: 11, maxMark: 20, remarks: 'Satisfactory', schoolId: school.id },
                { schoolType: 'PRIMARY', grade: 'E', minMark: 0, maxMark: 10, remarks: 'Fail', schoolId: school.id },
              ]
            : [
                { schoolType: 'SECONDARY', grade: 'A', minMark: 75, maxMark: 100, remarks: 'Excellent', points: 1, division: 'I', schoolId: school.id },
                { schoolType: 'SECONDARY', grade: 'B', minMark: 65, maxMark: 74, remarks: 'Very Good', points: 2, division: 'II', schoolId: school.id },
                { schoolType: 'SECONDARY', grade: 'C', minMark: 45, maxMark: 64, remarks: 'Good', points: 3, division: 'III', schoolId: school.id },
                { schoolType: 'SECONDARY', grade: 'D', minMark: 30, maxMark: 44, remarks: 'Satisfactory', points: 4, division: 'IV', schoolId: school.id },
                { schoolType: 'SECONDARY', grade: 'F', minMark: 0, maxMark: 29, remarks: 'Fail', points: 5, division: '0', schoolId: school.id },
              ];

        await db.gradingConfig.createMany({ data: gradingData });
        results.grading = `Created ${effectiveSchoolType} grading (${gradingData.length} grades)`;
      } else {
        results.grading = `${existingGrading} ${effectiveSchoolType} grading configs already exist`;
      }

      // === SEED CLASSES (with includePP12 support) ===
      const existingClasses = await db.class.count({
        where: { schoolId: school.id },
      });

      if (existingClasses === 0) {
        let classNames: string[];

        if (effectiveSchoolType === 'PRIMARY') {
          classNames = includePP12
            ? ['PP I', 'PP II', 'STD 1', 'STD 2', 'STD 3', 'STD 4', 'STD 5', 'STD 6', 'STD 7']
            : ['STD 1', 'STD 2', 'STD 3', 'STD 4', 'STD 5', 'STD 6', 'STD 7'];
        } else {
          classNames = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];
        }

        for (const className of classNames) {
          await db.class.create({
            data: {
              name: className,
              fullName: className,
              schoolType: effectiveSchoolType,
              schoolId: school.id,
              academicYear: new Date().getFullYear().toString(),
              term: 'FIRST TERM',
            },
          });
        }
        results.classes = `Created ${classNames.length} default classes${effectiveSchoolType === 'PRIMARY' ? (includePP12 ? ' (including PP I & PP II)' : ' (without PP I & PP II)') : ''}`;
      } else {
        results.classes = `${existingClasses} classes already exist`;
      }

      // Subjects are now a master catalogue. Class assignments are intentional
      // and are made by the administrator from Subjects > Assign to Class.
      results.classSubjects = 'Catalogue ready; assign subjects per class';

      // === LINK USER TO SCHOOL ===
      if (userId) {
        const user = await db.user.findUnique({ where: { id: userId } });
        if (user && !user.schoolId) {
          await db.user.update({
            where: { id: userId },
            data: { schoolId: school.id },
          });
          results.userLinked = `User ${user.username || user.email} linked to school`;
        } else if (user && user.schoolId) {
          results.userLinked = `User already linked to a school`;
        } else {
          results.userLinked = `User not found`;
        }
      }
    } else {
      results.message = 'No school found. Create a school first from Settings.';
    }

    // Set app setting for seed status
    await db.appSetting.upsert({
      where: { key: 'seeded' },
      create: { key: 'seeded', value: 'true' },
      update: { value: 'true' },
    });
    results.seeded = true;

    return NextResponse.json({
      message: 'Database seeded successfully',
      results,
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 });
  }
}
