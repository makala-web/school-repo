import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateActivationCode, getSchoolLicenseStatus } from '@/lib/access-control'
import { getAuthenticatedUser } from '@/lib/server-auth'

// GET: Get activation status or generate activation code
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')
    const schoolId = searchParams.get('schoolId')
    const actor = await getAuthenticatedUser(request)

    if (action === 'generate-code') {
      // Only SUPER_ADMIN can generate activation codes
      if (!actor || actor.role !== 'SUPER_ADMIN' || !actor.active) {
        return NextResponse.json({ success: false, error: 'Platform administrator access is required' }, { status: 403 })
      }

      const activationCode = generateActivationCode()
      return NextResponse.json({ success: true, activationCode })
    }

    if (action === 'check-status' && schoolId) {
      if (!actor) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
      if (actor.role !== 'SUPER_ADMIN' && actor.schoolId !== schoolId) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
      }
      const school = await db.school.findUnique({ where: { id: schoolId } })
      if (!school) {
        return NextResponse.json({ success: false, error: 'School not found' }, { status: 404 })
      }

      const licenseStatus = getSchoolLicenseStatus({
        status: school.licenseStatus || 'ACTIVE',
        expiryDate: school.expiryDate || undefined,
      })

      const deviceCount = await db.device.count({
        where: { schoolId, status: 'ACTIVE' }
      })

      const teacherCount = await db.teacher.count({
        where: { schoolId }
      })

      return NextResponse.json({
        success: true,
        school: {
          id: school.id,
          name: school.name,
          schoolType: school.schoolType,
          licenseType: school.licenseType,
          licenseStatus: licenseStatus,
          expiryDate: school.expiryDate,
          maxDevices: school.maxDevices,
          maxTeachers: school.maxTeachers,
          currentDevices: deviceCount,
          currentTeachers: teacherCount,
        }
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Activation check failed'
    }, { status: 500 })
  }
}

// POST: Activate school or update activation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, schoolId, activationCode, userId, licenseType, expiryDate, maxTeachers, maxDevices } = body
    const actor = await getAuthenticatedUser(request)

    if (action === 'activate-school') {
      if (!actor) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
      // Verify activation code
      if (!activationCode || !schoolId) {
        return NextResponse.json({ success: false, error: 'Activation code and school ID are required' }, { status: 400 })
      }

      const school = await db.school.findUnique({ where: { id: schoolId } })
      if (!school) {
        return NextResponse.json({ success: false, error: 'School not found' }, { status: 404 })
      }
      if (actor.role !== 'SUPER_ADMIN' && (actor.role !== 'SCHOOL_ADMIN' || actor.schoolId !== schoolId)) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
      }

      // Check if activation code matches
      if (school.activationCode !== activationCode) {
        return NextResponse.json({ success: false, error: 'Invalid activation code' }, { status: 401 })
      }

      // Check if already activated
      if (school.licenseStatus === 'ACTIVE' && !school.isDemo) {
        return NextResponse.json({ success: false, error: 'School is already activated' }, { status: 400 })
      }

      // Update school to active license
      const updatedSchool = await db.school.update({
        where: { id: schoolId },
        data: {
          licenseStatus: 'ACTIVE',
          licenseType: actor.role === 'SUPER_ADMIN' ? (licenseType || 'STANDARD') : school.licenseType,
          isDemo: false,
          expiryDate: actor.role === 'SUPER_ADMIN' ? (expiryDate || null) : school.expiryDate,
          maxTeachers: actor.role === 'SUPER_ADMIN' ? (maxTeachers || 20) : school.maxTeachers,
          maxDevices: actor.role === 'SUPER_ADMIN' ? (maxDevices || 20) : school.maxDevices,
          lastValidatedAt: new Date(),
        }
      })

      // Create school admin if userId provided
      if (userId) {
        const target = await db.user.findUnique({ where: { id: userId }, select: { schoolId: true } })
        if (!target || target.schoolId !== schoolId) {
          return NextResponse.json({ success: false, error: 'User does not belong to this school' }, { status: 403 })
        }
        await db.user.update({
          where: { id: userId },
          data: { role: 'SCHOOL_ADMIN' }
        })
      }

      return NextResponse.json({
        success: true,
        message: 'School activated successfully',
        school: updatedSchool
      })
    }

    if (action === 'assign-activation') {
      // SUPER_ADMIN assigns activation code to a school
      if (!actor || actor.role !== 'SUPER_ADMIN' || !actor.active) {
        return NextResponse.json({ success: false, error: 'Platform administrator access is required' }, { status: 403 })
      }

      if (!schoolId || !activationCode) {
        return NextResponse.json({ success: false, error: 'School ID and activation code are required' }, { status: 400 })
      }

      const school = await db.school.update({
        where: { id: schoolId },
        data: {
          activationCode,
          licenseType: licenseType || 'STANDARD',
          licenseStatus: 'ACTIVE',
          expiryDate: expiryDate || null,
          maxTeachers: maxTeachers || 20,
          maxDevices: maxDevices || 20,
          isDemo: false,
          lastValidatedAt: new Date(),
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Activation code assigned successfully',
        school
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Activation failed'
    }, { status: 500 })
  }
}
