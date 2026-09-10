import { NextRequest, NextResponse } from 'next/server';
import { SchoolRepository } from '@/repositories';
import type { SchoolType } from '@/types';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';

// Required for static export

// GET: Get grading configuration for a school
export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const schoolType = searchParams.get('schoolType');
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }
    if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const gradingConfigs = await SchoolRepository.getGradingConfigs(
      schoolId,
      (schoolType as SchoolType | null) || undefined
    );

    return NextResponse.json({ gradingConfigs });
  } catch (error) {
    console.error('Error fetching grading configs:', error);
    return NextResponse.json({ error: 'Failed to fetch grading configs' }, { status: 500 });
  }
}

// POST: Initialize default grading for a school
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (actor.role !== 'SCHOOL_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School administrator access is required' }, { status: 403 });
    }
    const body = await request.json();
    const { schoolId, schoolType } = body;

    if (!schoolId || !schoolType) {
      return NextResponse.json(
        { error: 'School ID and school type are required' },
        { status: 400 }
      );
    }
    if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await SchoolRepository.seedGradingConfigs(schoolId, schoolType as SchoolType);

    return NextResponse.json({
      message: `Default grading configuration created for ${schoolType}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error initializing grading:', error);
    return NextResponse.json({ error: 'Failed to initialize grading' }, { status: 500 });
  }
}

// PUT: Update a grading config entry
export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (actor.role !== 'SCHOOL_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School administrator access is required' }, { status: 403 });
    }
    const body = await request.json();
    const { id, grade, minMark, maxMark, remarks, points, division } = body;

    if (!id) {
      return NextResponse.json({ error: 'Grading config ID is required' }, { status: 400 });
    }
    const existing = await db.gradingConfig.findUnique({ where: { id }, select: { schoolId: true } });
    if (!existing) return NextResponse.json({ error: 'Grading config not found' }, { status: 404 });
    if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== existing.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const gradingConfig = await SchoolRepository.updateGradingConfig({
      id,
      grade,
      minMark,
      maxMark,
      remarks,
      points,
      division,
    });

    return NextResponse.json({
      message: 'Grading config updated successfully',
      gradingConfig,
    });
  } catch (error) {
    console.error('Error updating grading config:', error);
    return NextResponse.json({ error: 'Failed to update grading config' }, { status: 500 });
  }
}
