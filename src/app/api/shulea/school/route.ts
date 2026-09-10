import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, rejectDemoMutation } from '@/lib/server-auth';
import type { Prisma } from '@prisma/client';

// GET: Get current school info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId')

    console.log('[SCHOOL API] Getting schools. schoolId:', schoolId)

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 })
    }

    const actor = await getAuthenticatedUser(request)
    if (!actor || (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId)) {
      return NextResponse.json({ error: 'School access denied' }, { status: 403 })
    }

    const schools = await db.school.findMany({
      where: { id: schoolId },
      include: {
        _count: {
          select: {
            classes: true,
            students: true,
            teachers: true,
            subjects: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('[SCHOOL API] Returned schools:', schools.length, schools.map(s => ({ id: s.id, name: s.name, schoolType: s.schoolType })))
    return NextResponse.json({ schools });
  } catch (error) {
    console.error('Error fetching school:', error);
    return NextResponse.json({ error: 'Failed to fetch school info' }, { status: 500 });
  }
}

// POST: Create or update school info
export async function POST(request: NextRequest) {
  const demoBlock = await rejectDemoMutation(request); if (demoBlock) return demoBlock
  try {
    const actor = await getAuthenticatedUser(request)
    if (!actor) return NextResponse.json({ error: 'Authentication is required' }, { status: 401 })
    const body = await request.json();
    const {
      id,
      action,
      userId,
      name,
      schoolType,
      logo,
      logo2,
      registrationNo,
      council,
      region,
      district,
      ward,
      phone,
      email,
      headTeacherName,
      headTeacherSign,
      headTeacherComments,
      classTeacherName,
      classTeacherShortName,
      classTeacherComments,
      ctGradeA_en,
      ctGradeB_en,
      ctGradeC_en,
      ctGradeD_en,
      ctGradeE_en,
      ctGradeA_sw,
      ctGradeB_sw,
      ctGradeC_sw,
      ctGradeD_sw,
      ctGradeE_sw,
      htGradeA_en,
      htGradeB_en,
      htGradeC_en,
      htGradeD_en,
      htGradeE_en,
      htGradeA_sw,
      htGradeB_sw,
      htGradeC_sw,
      htGradeD_sw,
      htGradeE_sw,
      academicYear,
      term,
    } = body;

    if (id && (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(actor.role) || (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== id))) {
      return NextResponse.json({ error: 'You are not authorized to update this school' }, { status: 403 });
    }

    if (action === 'request-renewal') {
      if (!id || !userId) {
        return NextResponse.json({ error: 'School and user are required' }, { status: 400 });
      }
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user || !user.active || user.schoolId !== id) {
        return NextResponse.json({ error: 'You are not authorized for this school' }, { status: 403 });
      }
      const school = await db.school.update({
        where: { id },
        data: { renewalRequestedAt: new Date(), renewalRequestedBy: userId },
      });
      return NextResponse.json({ message: 'Renewal request submitted successfully', school });
    }

    // Handle logo-only updates (for logo upload from settings)
    if (id && (logo || logo2) && !name && !schoolType) {
      const updateData: Record<string, unknown> = {};
      
      if (logo) {
        // Validate base64 format
        const base64Match = logo.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
        if (!base64Match) {
          return NextResponse.json({ error: 'Invalid image format. Please upload a valid image file.' }, { status: 400 });
        }
        // Keep under ~500KB of base64 data for SQLite performance
        if (logo.length > 700000) {
          return NextResponse.json({ error: 'Image is too large. Please use a smaller image (under 200KB, max 200x200px recommended).' }, { status: 400 });
        }
        updateData.logo = logo;
      }

      if (logo2) {
        const base64Match2 = logo2.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
        if (!base64Match2) {
          return NextResponse.json({ error: 'Invalid image format for Logo 2. Please upload a valid image file.' }, { status: 400 });
        }
        if (logo2.length > 700000) {
          return NextResponse.json({ error: 'Image 2 is too large. Please use a smaller image (under 200KB, max 200x200px recommended).' }, { status: 400 });
        }
        updateData.logo2 = logo2;
      }

      try {
        const school = await db.school.update({
          where: { id },
          data: updateData,
        });
        return NextResponse.json({
          message: 'Logo updated successfully',
          school,
        });
      } catch (dbError) {
        console.error('Error saving logo to database:', dbError);
        return NextResponse.json({ error: 'Failed to save logo. Please try a smaller image.' }, { status: 500 });
      }
    }

    if (!name || !schoolType) {
      return NextResponse.json(
        { error: 'School name and type are required' },
        { status: 400 }
      );
    }

    if (!['PRIMARY', 'SECONDARY'].includes(schoolType)) {
      return NextResponse.json(
        { error: 'School type must be PRIMARY or SECONDARY' },
        { status: 400 }
      );
    }

    let school;

    if (id) {
      if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(actor.role) || (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== id)) {
        return NextResponse.json({ error: 'You are not authorized to update this school' }, { status: 403 });
      }
    } else if (actor.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only platform administrators can create schools' }, { status: 403 });
    }

    // Prepare data object, only include logo if provided
    const schoolData: Prisma.SchoolUncheckedCreateInput = {
      name,
      schoolType,
      registrationNo: registrationNo || null,
      council: council || null,
      region: region || null,
      district: district || null,
      ward: ward || null,
      phone: phone || null,
      email: email || null,
      headTeacherName: headTeacherName || null,
      headTeacherSign: headTeacherSign || null,
      headTeacherComments: headTeacherComments || null,
      classTeacherName: classTeacherName || null,
      classTeacherShortName: classTeacherShortName || null,
      classTeacherComments: classTeacherComments || null,
      ctGradeA_en: ctGradeA_en || null,
      ctGradeB_en: ctGradeB_en || null,
      ctGradeC_en: ctGradeC_en || null,
      ctGradeD_en: ctGradeD_en || null,
      ctGradeE_en: ctGradeE_en || null,
      ctGradeA_sw: ctGradeA_sw || null,
      ctGradeB_sw: ctGradeB_sw || null,
      ctGradeC_sw: ctGradeC_sw || null,
      ctGradeD_sw: ctGradeD_sw || null,
      ctGradeE_sw: ctGradeE_sw || null,
      htGradeA_en: htGradeA_en || null,
      htGradeB_en: htGradeB_en || null,
      htGradeC_en: htGradeC_en || null,
      htGradeD_en: htGradeD_en || null,
      htGradeE_en: htGradeE_en || null,
      htGradeA_sw: htGradeA_sw || null,
      htGradeB_sw: htGradeB_sw || null,
      htGradeC_sw: htGradeC_sw || null,
      htGradeD_sw: htGradeD_sw || null,
      htGradeE_sw: htGradeE_sw || null,
      academicYear: academicYear || null,
      term: term || null,
    };

    // Only include logo in data if explicitly provided
    if (logo) {
      schoolData.logo = logo;
    }
    if (logo2) {
      schoolData.logo2 = logo2;
    }

    if (id) {
      // Update existing school
      school = await db.school.update({
        where: { id },
        data: schoolData,
      });
    } else {
      // Create new school
      school = await db.school.create({
        data: {
          ...schoolData,
          logo: logo || null,
          logo2: logo2 || null,
        },
      });
    }

    return NextResponse.json({
      message: id ? 'School updated successfully' : 'School created successfully',
      school,
    });
  } catch (error) {
    console.error('Error saving school:', error);
    return NextResponse.json({ error: 'Failed to save school info' }, { status: 500 });
  }
}


